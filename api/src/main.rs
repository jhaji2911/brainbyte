use std::{
    collections::{HashMap, HashSet},
    net::SocketAddr,
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
};

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

type SharedState = Arc<AppState>;

#[tokio::main]
async fn main() {
    let state = Arc::new(AppState::seeded());

    let app = Router::new()
        .route("/health", get(health))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/me", get(me))
        .route("/onboarding", get(get_onboarding).post(upsert_onboarding))
        .route("/facts", get(list_facts))
        .route("/facts/random", get(random_fact))
        .route("/facts/generate", post(generate_fact))
        .route("/facts/{id}", get(get_fact))
        .route("/facts/{id}/save", post(save_fact).delete(unsave_fact))
        .route("/leaderboard", get(get_leaderboard))
        .route("/cms/sync", post(cms_sync))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    println!("BrainByte API listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind listener");
    axum::serve(listener, app).await.expect("serve app");
}

struct AppState {
    store: RwLock<Store>,
    next_id: AtomicU64,
}

impl AppState {
    fn seeded() -> Self {
        let facts = seeded_facts();
        let users = seeded_users();
        let onboarding = HashMap::from([(
            "user-1".to_string(),
            OnboardingProfile {
                selected_poison: "History".to_string(),
                daily_goal: "Growth (5-7 bytes)".to_string(),
                interrupts_enabled: true,
                updated_at: Utc::now(),
            },
        )]);
        let saved_facts = HashMap::from([(
            "user-1".to_string(),
            HashSet::from([
                "fact-3".to_string(),
                "fact-4".to_string(),
                "fact-5".to_string(),
            ]),
        )]);
        let sessions = HashMap::from([("seed-token-felix".to_string(), "user-1".to_string())]);

        Self {
            store: RwLock::new(Store {
                users,
                facts,
                sessions,
                onboarding,
                saved_facts,
            }),
            next_id: AtomicU64::new(100),
        }
    }

    fn next_id(&self, prefix: &str) -> String {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        format!("{prefix}-{id}")
    }
}

struct Store {
    users: HashMap<String, UserRecord>,
    facts: Vec<Fact>,
    sessions: HashMap<String, String>,
    onboarding: HashMap<String, OnboardingProfile>,
    saved_facts: HashMap<String, HashSet<String>>,
}

#[derive(Clone, Serialize)]
struct HealthResponse {
    status: &'static str,
    service: &'static str,
}

#[derive(Clone, Serialize, Deserialize)]
struct Fact {
    id: String,
    category: String,
    title: String,
    content: String,
    curated_by: Option<Curator>,
    image: Option<String>,
    source: Option<String>,
    progress: Option<u8>,
    saved_at: Option<String>,
    created_by: String,
    created_at: DateTime<Utc>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Curator {
    name: String,
    avatar: String,
}

#[derive(Clone)]
struct UserRecord {
    id: String,
    email: String,
    password: String,
    profile: UserProfile,
}

#[derive(Clone, Serialize, Deserialize)]
struct UserProfile {
    id: String,
    name: String,
    avatar: String,
    xp: u32,
    streak: u32,
    focus_minutes: u32,
    learned_bytes: u32,
    rank: u32,
}

#[derive(Clone, Serialize, Deserialize)]
struct OnboardingProfile {
    selected_poison: String,
    daily_goal: String,
    interrupts_enabled: bool,
    updated_at: DateTime<Utc>,
}

#[derive(Deserialize)]
struct RegisterRequest {
    name: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct UpsertOnboardingRequest {
    selected_poison: String,
    daily_goal: String,
    interrupts_enabled: bool,
}

#[derive(Deserialize)]
struct FactsQuery {
    category: Option<String>,
    saved_only: Option<bool>,
}

#[derive(Deserialize)]
struct RandomFactQuery {
    category: Option<String>,
}

#[derive(Deserialize)]
struct GenerateFactRequest {
    category: Option<String>,
    prompt: Option<String>,
}

#[derive(Serialize)]
struct ApiResponse<T> {
    data: T,
}

#[derive(Serialize)]
struct AuthPayload {
    token: String,
    user: UserProfile,
}

#[derive(Serialize)]
struct MePayload {
    user: UserProfile,
    onboarding: Option<OnboardingProfile>,
    saved_fact_ids: Vec<String>,
}

#[derive(Serialize)]
struct FactsPayload {
    facts: Vec<Fact>,
}

#[derive(Serialize)]
struct FactPayload {
    fact: Fact,
    saved: bool,
}

#[derive(Serialize)]
struct SavePayload {
    fact_id: String,
    saved: bool,
}

#[derive(Serialize)]
struct LeaderboardPayload {
    season: SeasonSummary,
    entries: Vec<LeaderboardEntry>,
}

#[derive(Serialize)]
struct SeasonSummary {
    league_name: String,
    division: String,
    round: u8,
    total_rounds: u8,
    promotion_cutoff_rank: u8,
    time_left: String,
}

#[derive(Serialize)]
struct LeaderboardEntry {
    id: String,
    name: String,
    xp: u32,
    streak: u32,
    avatar: String,
    rank: u32,
    is_me: bool,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

async fn health() -> Json<ApiResponse<HealthResponse>> {
    Json(ApiResponse {
        data: HealthResponse {
            status: "ok",
            service: "brainbyte-api",
        },
    })
}

async fn register(
    State(state): State<SharedState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<ApiResponse<AuthPayload>>, ApiError> {
    validate_credentials(&payload.email, &payload.password)?;

    let mut store = state.store.write().await;
    if store.users.values().any(|user| user.email == payload.email) {
        return Err(ApiError::conflict("email is already registered"));
    }

    let user_id = state.next_id("user");
    let token = state.next_id("token");
    let profile = UserProfile {
        id: user_id.clone(),
        name: payload.name.trim().to_string(),
        avatar: format!("https://i.pravatar.cc/150?u={}", payload.email),
        xp: 900,
        streak: 1,
        focus_minutes: 0,
        learned_bytes: 0,
        rank: 0,
    };

    store.users.insert(
        user_id.clone(),
        UserRecord {
            id: user_id.clone(),
            email: payload.email.trim().to_lowercase(),
            password: payload.password,
            profile: profile.clone(),
        },
    );
    store.sessions.insert(token.clone(), user_id);
    store.saved_facts.insert(profile.id.clone(), HashSet::new());

    Ok(Json(ApiResponse {
        data: AuthPayload {
            token,
            user: profile,
        },
    }))
}

async fn login(
    State(state): State<SharedState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<ApiResponse<AuthPayload>>, ApiError> {
    let store = state.store.read().await;
    let user = store
        .users
        .values()
        .find(|user| user.email == payload.email.trim().to_lowercase())
        .ok_or_else(|| ApiError::unauthorized("invalid email or password"))?;

    if user.password != payload.password {
        return Err(ApiError::unauthorized("invalid email or password"));
    }

    let user_id = user.id.clone();
    let profile = user.profile.clone();
    let token = state.next_id("token");
    drop(store);

    let mut store = state.store.write().await;
    store.sessions.insert(token.clone(), user_id);

    Ok(Json(ApiResponse {
        data: AuthPayload {
            token,
            user: profile,
        },
    }))
}

async fn me(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<MePayload>>, ApiError> {
    let user_id = authorized_user_id(&state, &headers).await?;
    let store = state.store.read().await;
    let user = store
        .users
        .get(&user_id)
        .ok_or_else(|| ApiError::unauthorized("session is invalid"))?;
    let onboarding = store.onboarding.get(&user_id).cloned();
    let saved_fact_ids = store
        .saved_facts
        .get(&user_id)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .collect();

    Ok(Json(ApiResponse {
        data: MePayload {
            user: user.profile.clone(),
            onboarding,
            saved_fact_ids,
        },
    }))
}

async fn get_onboarding(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<OnboardingProfile>>, ApiError> {
    let user_id = authorized_user_id(&state, &headers).await?;
    let store = state.store.read().await;
    let profile = store
        .onboarding
        .get(&user_id)
        .cloned()
        .ok_or_else(|| ApiError::not_found("onboarding profile not found"))?;

    Ok(Json(ApiResponse { data: profile }))
}

async fn upsert_onboarding(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(payload): Json<UpsertOnboardingRequest>,
) -> Result<Json<ApiResponse<OnboardingProfile>>, ApiError> {
    let user_id = authorized_user_id(&state, &headers).await?;
    let profile = OnboardingProfile {
        selected_poison: require_non_empty("selected_poison", &payload.selected_poison)?,
        daily_goal: require_non_empty("daily_goal", &payload.daily_goal)?,
        interrupts_enabled: payload.interrupts_enabled,
        updated_at: Utc::now(),
    };

    let mut store = state.store.write().await;
    store.onboarding.insert(user_id, profile.clone());

    Ok(Json(ApiResponse { data: profile }))
}

async fn list_facts(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Query(query): Query<FactsQuery>,
) -> Result<Json<ApiResponse<FactsPayload>>, ApiError> {
    let maybe_user = optional_user_id(&state, &headers).await;
    let store = state.store.read().await;

    let saved_set = maybe_user
        .as_ref()
        .and_then(|user_id| store.saved_facts.get(user_id))
        .cloned()
        .unwrap_or_default();

    let facts = store
        .facts
        .iter()
        .filter(|fact| {
            query
                .category
                .as_ref()
                .is_none_or(|category| fact.category.eq_ignore_ascii_case(category))
        })
        .filter(|fact| !query.saved_only.unwrap_or(false) || saved_set.contains(&fact.id))
        .cloned()
        .collect();

    Ok(Json(ApiResponse {
        data: FactsPayload { facts },
    }))
}

async fn random_fact(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Query(query): Query<RandomFactQuery>,
) -> Result<Json<ApiResponse<FactPayload>>, ApiError> {
    let maybe_user = optional_user_id(&state, &headers).await;
    let store = state.store.read().await;
    let filtered: Vec<_> = store
        .facts
        .iter()
        .filter(|fact| {
            query
                .category
                .as_ref()
                .is_none_or(|category| fact.category.eq_ignore_ascii_case(category))
        })
        .cloned()
        .collect();

    if filtered.is_empty() {
        return Err(ApiError::not_found("no facts available for this filter"));
    }

    let index = (Utc::now()
        .timestamp_nanos_opt()
        .unwrap_or_default()
        .unsigned_abs() as usize)
        % filtered.len();
    let fact = filtered[index].clone();
    let saved = maybe_user
        .and_then(|user_id| store.saved_facts.get(&user_id).cloned())
        .is_some_and(|saved| saved.contains(&fact.id));

    Ok(Json(ApiResponse {
        data: FactPayload { fact, saved },
    }))
}

async fn generate_fact(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Json(payload): Json<GenerateFactRequest>,
) -> Result<Json<ApiResponse<FactPayload>>, ApiError> {
    let user_id = authorized_user_id(&state, &headers).await?;
    let mut store = state.store.write().await;
    let user = store
        .users
        .get_mut(&user_id)
        .ok_or_else(|| ApiError::unauthorized("session is invalid"))?;

    let category = payload
        .category
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Curiosity".to_string());
    let prompt = payload
        .prompt
        .unwrap_or_else(|| "a small mental reset".to_string());
    let fact = build_generated_fact(&state, &category, &prompt, &user.profile.name);

    user.profile.learned_bytes += 1;
    user.profile.xp += 120;

    store.facts.insert(0, fact.clone());

    Ok(Json(ApiResponse {
        data: FactPayload { fact, saved: false },
    }))
}

async fn get_fact(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<FactPayload>>, ApiError> {
    let maybe_user = optional_user_id(&state, &headers).await;
    let store = state.store.read().await;
    let fact = store
        .facts
        .iter()
        .find(|fact| fact.id == id)
        .cloned()
        .ok_or_else(|| ApiError::not_found("fact not found"))?;
    let saved = maybe_user
        .and_then(|user_id| store.saved_facts.get(&user_id).cloned())
        .is_some_and(|saved| saved.contains(&fact.id));

    Ok(Json(ApiResponse {
        data: FactPayload { fact, saved },
    }))
}

async fn save_fact(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<SavePayload>>, ApiError> {
    save_state_change(state, headers, id, true).await
}

async fn unsave_fact(
    State(state): State<SharedState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<SavePayload>>, ApiError> {
    save_state_change(state, headers, id, false).await
}

async fn save_state_change(
    state: SharedState,
    headers: HeaderMap,
    fact_id: String,
    save: bool,
) -> Result<Json<ApiResponse<SavePayload>>, ApiError> {
    let user_id = authorized_user_id(&state, &headers).await?;
    let mut store = state.store.write().await;

    if !store.facts.iter().any(|fact| fact.id == fact_id) {
        return Err(ApiError::not_found("fact not found"));
    }

    let saved_facts = store.saved_facts.entry(user_id).or_default();
    if save {
        saved_facts.insert(fact_id.clone());
    } else {
        saved_facts.remove(&fact_id);
    }

    Ok(Json(ApiResponse {
        data: SavePayload {
            fact_id,
            saved: save,
        },
    }))
}

async fn get_leaderboard(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<LeaderboardPayload>>, ApiError> {
    let maybe_user = optional_user_id(&state, &headers).await;
    let store = state.store.read().await;

    let mut entries: Vec<_> = store
        .users
        .values()
        .map(|user| LeaderboardEntry {
            id: user.id.clone(),
            name: user.profile.name.clone(),
            xp: user.profile.xp,
            streak: user.profile.streak,
            avatar: user.profile.avatar.clone(),
            rank: 0,
            is_me: maybe_user.as_ref().is_some_and(|id| id == &user.id),
        })
        .collect();

    entries.sort_by(|a, b| b.xp.cmp(&a.xp).then(b.streak.cmp(&a.streak)));
    for (index, entry) in entries.iter_mut().enumerate() {
        entry.rank = (index + 1) as u32;
    }

    Ok(Json(ApiResponse {
        data: LeaderboardPayload {
            season: SeasonSummary {
                league_name: "Obsidian League".to_string(),
                division: "Scholars Division".to_string(),
                round: 4,
                total_rounds: 12,
                promotion_cutoff_rank: 10,
                time_left: "2d 14h 05m".to_string(),
            },
            entries,
        },
    }))
}

async fn authorized_user_id(state: &SharedState, headers: &HeaderMap) -> Result<String, ApiError> {
    optional_user_id(state, headers)
        .await
        .ok_or_else(|| ApiError::unauthorized("missing or invalid bearer token"))
}

async fn optional_user_id(state: &SharedState, headers: &HeaderMap) -> Option<String> {
    let token = bearer_token(headers)?;
    let store = state.store.read().await;
    store.sessions.get(token).cloned()
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(axum::http::header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
}

fn validate_credentials(email: &str, password: &str) -> Result<(), ApiError> {
    if !email.contains('@') {
        return Err(ApiError::bad_request("email must be valid"));
    }
    if password.len() < 8 {
        return Err(ApiError::bad_request(
            "password must be at least 8 characters",
        ));
    }
    Ok(())
}

fn require_non_empty(field: &str, value: &str) -> Result<String, ApiError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(ApiError::bad_request(format!("{field} is required")));
    }
    Ok(trimmed.to_string())
}

fn build_generated_fact(
    state: &SharedState,
    category: &str,
    prompt: &str,
    author_name: &str,
) -> Fact {
    let templates = [
        (
            "Tiny leverage beats giant plans",
            "A useful brain-byte is one that lowers the effort of starting. When a task feels sticky, shrink the first action until your resistance loses its excuse.",
        ),
        (
            "Attention follows uncertainty",
            "Your brain allocates more energy to unfinished loops than settled ones. Packaging knowledge as a question first can improve recall when the answer lands.",
        ),
        (
            "Memory likes contrast",
            "Facts stick better when they collide with an expectation. If you want retention, pair the concept with a surprising counterexample instead of a neutral definition.",
        ),
    ];
    let idx = state.next_id.load(Ordering::Relaxed) as usize % templates.len();
    let (title, content) = templates[idx];

    Fact {
        id: state.next_id("fact"),
        category: category.to_string(),
        title: format!("{title}: {}", truncate(prompt, 28)),
        content: format!("{content} Prompt context: {prompt}."),
        curated_by: Some(Curator {
            name: author_name.to_string(),
            avatar: "https://i.pravatar.cc/150?u=generated".to_string(),
        }),
        image: None,
        source: Some("BrainByte Generator".to_string()),
        progress: None,
        saved_at: None,
        created_by: "generator".to_string(),
        created_at: Utc::now(),
    }
}

fn truncate(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

// ─── Payload CMS sync ──────────────────────────────────────────────────────

/// Shape of a fact document returned by the Payload CMS REST API (`GET /api/facts`).
#[derive(Deserialize)]
struct CmsFactDoc {
    id: String,
    title: String,
    category: CmsCategoryDoc,
    content: String,
    image: Option<String>,
    source: Option<String>,
    #[serde(rename = "curatedBy")]
    curated_by: Option<CmsCuratorDoc>,
    #[serde(rename = "publishedAt")]
    published_at: Option<String>,
}

#[derive(Deserialize)]
struct CmsCategoryDoc {
    name: String,
}

#[derive(Deserialize)]
struct CmsCuratorDoc {
    name: Option<String>,
    avatar: Option<String>,
}

#[derive(Deserialize)]
struct CmsFactsResponse {
    docs: Vec<CmsFactDoc>,
}

#[derive(Serialize)]
struct CmsSyncPayload {
    synced: usize,
    skipped: usize,
}

/// POST /cms/sync
///
/// Fetches all published facts from the Payload CMS REST API and upserts them
/// into the in-memory facts store.  Requires the `X-Sync-Secret` header to
/// match the `CMS_SYNC_SECRET` environment variable (both default to
/// "dev-sync-secret" when unset, but you should set a strong value in
/// production).
async fn cms_sync(
    State(state): State<SharedState>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<CmsSyncPayload>>, ApiError> {
    let expected_secret =
        std::env::var("CMS_SYNC_SECRET").unwrap_or_else(|_| "dev-sync-secret".to_string());
    let provided = headers
        .get("x-sync-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided != expected_secret {
        return Err(ApiError::unauthorized("invalid sync secret"));
    }

    let cms_url =
        std::env::var("CMS_API_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let url = format!(
        "{cms_url}/api/facts?where[status][equals]=published&depth=1&limit=200"
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| ApiError::internal(format!("CMS request failed: {e}")))?;

    if !response.status().is_success() {
        return Err(ApiError::internal(format!(
            "CMS returned HTTP {}",
            response.status()
        )));
    }

    let cms_facts: CmsFactsResponse = response
        .json()
        .await
        .map_err(|e| ApiError::internal(format!("CMS response parse error: {e}")))?;

    let mut store = state.store.write().await;
    let mut synced = 0usize;
    let mut skipped = 0usize;

    for doc in cms_facts.docs {
        let cms_id = format!("cms-{}", doc.id);
        if store.facts.iter().any(|f| f.id == cms_id) {
            // Already synced — update content in-place
            if let Some(existing) = store.facts.iter_mut().find(|f| f.id == cms_id) {
                existing.title = doc.title;
                existing.category = doc.category.name;
                existing.content = doc.content;
                existing.image = doc.image;
                existing.source = doc.source;
                existing.curated_by = doc.curated_by.and_then(|c| {
                    Some(Curator {
                        name: c.name?,
                        avatar: c.avatar.unwrap_or_default(),
                    })
                });
            }
            skipped += 1;
        } else {
            let fact = Fact {
                id: cms_id,
                category: doc.category.name,
                title: doc.title,
                content: doc.content,
                curated_by: doc.curated_by.and_then(|c| {
                    Some(Curator {
                        name: c.name?,
                        avatar: c.avatar.unwrap_or_default(),
                    })
                }),
                image: doc.image,
                source: doc.source,
                progress: None,
                saved_at: None,
                created_by: "cms".to_string(),
                created_at: doc
                    .published_at
                    .and_then(|s| s.parse::<DateTime<Utc>>().ok())
                    .unwrap_or_else(Utc::now),
            };
            store.facts.push(fact);
            synced += 1;
        }
    }

    Ok(Json(ApiResponse {
        data: CmsSyncPayload { synced, skipped },
    }))
}

fn seeded_facts() -> Vec<Fact> {
    vec![
        Fact {
            id: "fact-1".to_string(),
            category: "Vocab Word of the Day".to_string(),
            title: "Petrichor".to_string(),
            content: "The pleasant, earthy smell that frequently accompanies the first rain after a long period of warm, dry weather.".to_string(),
            curated_by: Some(Curator {
                name: "EtymologyNow".to_string(),
                avatar: "https://picsum.photos/seed/etym/100/100".to_string(),
            }),
            image: None,
            source: None,
            progress: None,
            saved_at: None,
            created_by: "seed".to_string(),
            created_at: Utc::now(),
        },
        Fact {
            id: "fact-2".to_string(),
            category: "Physics of Light".to_string(),
            title: "Why the Sky is Blue".to_string(),
            content: "It's all about Rayleigh scattering. Sunlight reaches Earth's atmosphere and is scattered in all directions by gases and particles. Blue light has shorter wavelengths and scatters more strongly, so the sky appears blue to us.".to_string(),
            curated_by: None,
            image: Some("https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&q=80&w=1000".to_string()),
            source: Some("NASA Science".to_string()),
            progress: None,
            saved_at: None,
            created_by: "seed".to_string(),
            created_at: Utc::now(),
        },
        Fact {
            id: "fact-3".to_string(),
            category: "Psychology".to_string(),
            title: "The Pratfall Effect".to_string(),
            content: "Highly competent people can become more likable after making a small mistake because the mistake signals humanity instead of distance.".to_string(),
            curated_by: None,
            image: None,
            source: None,
            progress: Some(65),
            saved_at: Some("2 days ago".to_string()),
            created_by: "seed".to_string(),
            created_at: Utc::now(),
        },
        Fact {
            id: "fact-4".to_string(),
            category: "Neuroscience".to_string(),
            title: "Myelin Sheaths".to_string(),
            content: "Repeated practice strengthens neural signal delivery by improving myelination, which helps the pathway fire faster and more reliably.".to_string(),
            curated_by: None,
            image: None,
            source: None,
            progress: None,
            saved_at: Some("2 days ago".to_string()),
            created_by: "seed".to_string(),
            created_at: Utc::now(),
        },
        Fact {
            id: "fact-5".to_string(),
            category: "Productivity".to_string(),
            title: "Zeigarnik Effect".to_string(),
            content: "People tend to remember unfinished tasks better than completed ones, which is why open loops keep tugging at your attention.".to_string(),
            curated_by: None,
            image: Some("https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&q=80&w=1000".to_string()),
            source: None,
            progress: None,
            saved_at: None,
            created_by: "seed".to_string(),
            created_at: Utc::now(),
        },
    ]
}

fn seeded_users() -> HashMap<String, UserRecord> {
    [
        UserRecord {
            id: "user-2".to_string(),
            email: "sarah@example.com".to_string(),
            password: "password123".to_string(),
            profile: UserProfile {
                id: "user-2".to_string(),
                name: "Sarah K.".to_string(),
                avatar: "https://i.pravatar.cc/150?u=sarah".to_string(),
                xp: 14200,
                streak: 48,
                focus_minutes: 680,
                learned_bytes: 143,
                rank: 1,
            },
        },
        UserRecord {
            id: "user-3".to_string(),
            email: "alex@example.com".to_string(),
            password: "password123".to_string(),
            profile: UserProfile {
                id: "user-3".to_string(),
                name: "Alex Chen".to_string(),
                avatar: "https://i.pravatar.cc/150?u=alex".to_string(),
                xp: 12850,
                streak: 102,
                focus_minutes: 720,
                learned_bytes: 121,
                rank: 2,
            },
        },
        UserRecord {
            id: "user-4".to_string(),
            email: "jordan@example.com".to_string(),
            password: "password123".to_string(),
            profile: UserProfile {
                id: "user-4".to_string(),
                name: "Jordan_X".to_string(),
                avatar: "https://i.pravatar.cc/150?u=jordan".to_string(),
                xp: 11400,
                streak: 31,
                focus_minutes: 540,
                learned_bytes: 110,
                rank: 3,
            },
        },
        UserRecord {
            id: "user-1".to_string(),
            email: "felix@example.com".to_string(),
            password: "password123".to_string(),
            profile: UserProfile {
                id: "user-1".to_string(),
                name: "Felix".to_string(),
                avatar: "https://i.pravatar.cc/150?u=me".to_string(),
                xp: 10920,
                streak: 12,
                focus_minutes: 247,
                learned_bytes: 12,
                rank: 4,
            },
        },
        UserRecord {
            id: "user-5".to_string(),
            email: "maya@example.com".to_string(),
            password: "password123".to_string(),
            profile: UserProfile {
                id: "user-5".to_string(),
                name: "Maya.Dev".to_string(),
                avatar: "https://i.pravatar.cc/150?u=maya".to_string(),
                xp: 9800,
                streak: 24,
                focus_minutes: 455,
                learned_bytes: 99,
                rank: 5,
            },
        },
        UserRecord {
            id: "user-6".to_string(),
            email: "lukas@example.com".to_string(),
            password: "password123".to_string(),
            profile: UserProfile {
                id: "user-6".to_string(),
                name: "Lukas_01".to_string(),
                avatar: "https://i.pravatar.cc/150?u=lukas".to_string(),
                xp: 9450,
                streak: 7,
                focus_minutes: 388,
                learned_bytes: 88,
                rank: 6,
            },
        },
    ]
    .into_iter()
    .map(|user| (user.id.clone(), user))
    .collect()
}

struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    fn conflict(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            Json(ErrorResponse {
                error: self.message,
            }),
        )
            .into_response()
    }
}
