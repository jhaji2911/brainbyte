use serde::{Deserialize, Serialize};
use std::env;

/// Base URL of the BrainByte Agent (RL-CoT) service.
fn agent_base_url() -> String {
    env::var("BRAINBYTE_AGENT_URL").unwrap_or_else(|_| "http://localhost:8090".to_string())
}

// ── Request/response shapes matching the agent's API ───────────────────────

#[derive(Serialize)]
pub(crate) struct RecommendRequest {
    pub(crate) user_id: String,
    pub(crate) n_results: i32,
}

#[derive(Deserialize, Debug)]
pub(crate) struct RecommendResponse {
    pub(crate) user_id: String,
    pub(crate) recommendations: Vec<RecommendedContent>,
    pub(crate) cot_trace: serde_json::Value,
    pub(crate) timestamp: String,
}

#[derive(Deserialize, Debug, Clone)]
pub(crate) struct RecommendedContent {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) category: String,
    pub(crate) difficulty: f64,
    pub(crate) score: f64,
    pub(crate) reason: String,
}

#[derive(Serialize)]
pub(crate) struct LearnRequest {
    pub(crate) user_id: String,
    pub(crate) content_id: String,
    pub(crate) action: String,
    pub(crate) dwell_time: f64,
    pub(crate) rating: f64,
}

#[derive(Deserialize, Debug)]
pub(crate) struct LearnResponse {
    pub(crate) status: String,
    pub(crate) reward: f64,
    pub(crate) episode_id: String,
    pub(crate) message: String,
}

#[derive(Serialize)]
pub(crate) struct UserCreateRequest {
    pub(crate) user_id: String,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) interests: Vec<String>,
    #[serde(default)]
    pub(crate) learning_goals: Vec<String>,
}

#[derive(Deserialize, Debug)]
pub(crate) struct UserCreateResponse {
    pub(crate) status: String,
}

#[derive(Serialize)]
pub(crate) struct ContentIndexRequest {
    pub(crate) content_id: String,
    pub(crate) title: String,
    pub(crate) body: String,
    pub(crate) category: String,
    #[serde(default)]
    pub(crate) tags: Vec<String>,
    pub(crate) difficulty: f64,
    #[serde(default)]
    pub(crate) source: String,
}

#[derive(Deserialize, Debug)]
pub(crate) struct ContentIndexResponse {
    pub(crate) status: String,
}

// ── Agent API client methods ────────────────────────────────────────────────

/// Get personalised recommendations for a user from the RL-CoT agent.
pub(crate) async fn recommend(
    user_id: &str,
    n_results: i32,
) -> Result<RecommendResponse, String> {
    let url = format!("{}/recommend", agent_base_url());
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&RecommendRequest {
            user_id: user_id.to_string(),
            n_results,
        })
        .send()
        .await
        .map_err(|e| format!("agent /recommend request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("agent /recommend returned {status}: {body}"));
    }

    resp.json::<RecommendResponse>()
        .await
        .map_err(|e| format!("agent /recommend parse failed: {e}"))
}

/// Send a learning signal to the agent based on user interaction.
pub(crate) async fn learn(
    user_id: &str,
    content_id: &str,
    action: &str,
    dwell_time: f64,
    rating: f64,
) -> Result<LearnResponse, String> {
    let url = format!("{}/learn", agent_base_url());
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&LearnRequest {
            user_id: user_id.to_string(),
            content_id: content_id.to_string(),
            action: action.to_string(),
            dwell_time,
            rating,
        })
        .send()
        .await
        .map_err(|e| format!("agent /learn request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("agent /learn returned {status}: {body}"));
    }

    resp.json::<LearnResponse>()
        .await
        .map_err(|e| format!("agent /learn parse failed: {e}"))
}

/// Create or update a user profile in the agent's memory.
pub(crate) async fn create_user(
    user_id: &str,
    name: &str,
    interests: Vec<String>,
    learning_goals: Vec<String>,
) -> Result<UserCreateResponse, String> {
    let url = format!("{}/user/create", agent_base_url());
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&UserCreateRequest {
            user_id: user_id.to_string(),
            name: name.to_string(),
            interests,
            learning_goals,
        })
        .send()
        .await
        .map_err(|e| format!("agent /user/create request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("agent /user/create returned {status}: {body}"));
    }

    resp.json::<UserCreateResponse>()
        .await
        .map_err(|e| format!("agent /user/create parse failed: {e}"))
}

/// Index a single content item in the agent's knowledge base.
pub(crate) async fn index_content(
    content_id: &str,
    title: &str,
    body: &str,
    category: &str,
    tags: Vec<String>,
    difficulty: f64,
    source: &str,
) -> Result<ContentIndexResponse, String> {
    let url = format!("{}/content/index", agent_base_url());
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&ContentIndexRequest {
            content_id: content_id.to_string(),
            title: title.to_string(),
            body: body.to_string(),
            category: category.to_string(),
            tags,
            difficulty,
            source: source.to_string(),
        })
        .send()
        .await
        .map_err(|e| format!("agent /content/index request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("agent /content/index returned {status}: {body}"));
    }

    resp.json::<ContentIndexResponse>()
        .await
        .map_err(|e| format!("agent /content/index parse failed: {e}"))
}

/// Index multiple content items in the agent's knowledge base.
pub(crate) async fn bulk_index_contents(
    items: Vec<ContentIndexRequest>,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/content/bulk-index", agent_base_url());
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&items)
        .send()
        .await
        .map_err(|e| format!("agent /content/bulk-index request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("agent /content/bulk-index returned {status}: {body}"));
    }

    resp.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("agent /content/bulk-index parse failed: {e}"))
}
