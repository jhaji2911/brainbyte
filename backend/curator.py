"""
BrainByte Curator — LLM-powered content generation.
====================================================
The curator uses any OpenAI-compatible LLM to generate bite-sized
micro-learning content on any topic, at any difficulty, in any format.

Supports:
- Any OpenAI-compatible API (Groq, Together, Ollama, OpenRouter, etc.)
- Mock mode for demos without an API key
- Structured output: title, content, category, difficulty, format

Configure via env: LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
"""

import json
from dataclasses import dataclass
from typing import Optional

from llm_client import LLMClient, LLMConfig, load_llm_config


@dataclass
class CuratedByte:
    title: str
    content: str
    category: str
    difficulty: float  # 0.0 (beginner) to 1.0 (expert)
    format: str  # "fact", "comparison", "quiz", "story", "howto"
    source: str  # "LLM-curated" or mock source
    tags: list


# ── Mock content for when no API key is available ───────────────────────────

_MOCK_LIBRARY = {
    ("physics", "beginner", "fact"): CuratedByte(
        title="Why Things Fall",
        content="Gravity isn't a force pulling things down — it's the curvature of spacetime itself. Massive objects like Earth bend the fabric of the universe, and smaller objects simply follow those curves. This is Einstein's General Relativity, and it's why astronauts float: they're falling around Earth, not away from it.",
        category="Physics",
        difficulty=0.2,
        format="fact",
        source="mock-curator",
        tags=["physics", "gravity", "einstein"],
    ),
    ("physics", "intermediate", "comparison"): CuratedByte(
        title="Quantum vs Classical: The Measurement Problem",
        content="In classical physics, measuring a ball's position doesn't change the ball. In quantum mechanics, measuring a particle's position forces it to 'choose' a state. Before measurement, it existed in a superposition — all possible positions at once. The act of observation collapses the wavefunction. This isn't a limitation of our tools; it's a fundamental feature of reality.",
        category="Physics",
        difficulty=0.5,
        format="comparison",
        source="mock-curator",
        tags=["physics", "quantum", "measurement"],
    ),
    ("biology", "beginner", "fact"): CuratedByte(
        title="Your Brain's Cleanup Crew",
        content="While you sleep, your brain activates the glymphatic system — a network that flushes out toxic proteins that build up during the day, including beta-amyloid (linked to Alzheimer's). Cerebrospinal fluid pulses through your brain tissue, clearing waste products. This is why pulling all-nighters doesn't just make you tired — it literally leaves garbage in your brain.",
        category="Biology",
        difficulty=0.2,
        format="fact",
        source="mock-curator",
        tags=["biology", "neuroscience", "sleep"],
    ),
    ("biology", "intermediate", "howto"): CuratedByte(
        title="How to Boost Mitochondrial Density",
        content="Mitochondria are your cells' power plants. You can increase their density through: 1) Zone 2 cardio — 45+ min at conversational pace, 3-4x weekly. 2) Cold exposure — 11 min/week total at ~50°F triggers mitochondrial biogenesis. 3) HIIT — short bursts signal your body that more energy factories are needed. Each method works through a different pathway (AMPK, PGC-1α, and calcium signaling respectively).",
        category="Biology",
        difficulty=0.5,
        format="howto",
        source="mock-curator",
        tags=["biology", "health", "mitochondria"],
    ),
    ("history", "beginner", "story"): CuratedByte(
        title="The Telegram That Changed Everything",
        content="In 1917, British intelligence intercepted a coded message from Germany to Mexico: the Zimmermann Telegram. Germany proposed that if Mexico joined WWI against the US, they'd help Mexico reclaim Texas, Arizona, and New Mexico. Britain cracked the code and leaked it to the US press. American public opinion — previously anti-war — flipped overnight. The US entered WWI six weeks later.",
        category="History",
        difficulty=0.2,
        format="story",
        source="mock-curator",
        tags=["history", "WWI", "cryptography"],
    ),
    ("history", "advanced", "comparison"): CuratedByte(
        title="Fall of Empires: Rome vs Britain",
        content="Rome fell over 300 years (crisis, fragmentation, sack). Britain's empire unwound in 30 (1947-1970s). The difference? Rome's collapse was internal — political decay, economic collapse, military overreach. Britain's was negotiated — post-WWII debt, US pressure, independence movements. Both lost hegemony, but through fundamentally different mechanisms: entropy vs. transaction.",
        category="History",
        difficulty=0.8,
        format="comparison",
        source="mock-curator",
        tags=["history", "empires", "comparative"],
    ),
    ("psychology", "beginner", "fact"): CuratedByte(
        title="The Pratfall Effect",
        content="Competent people become more likable after making a small mistake. In a classic experiment, participants rated a quiz contestant who spilled coffee higher than one who was flawless — but only if they'd already demonstrated high competence. The blunder signals 'I'm human too.' Vulnerability, when earned, is social currency.",
        category="Psychology",
        difficulty=0.2,
        format="fact",
        source="mock-curator",
        tags=["psychology", "social", "bias"],
    ),
    ("psychology", "intermediate", "quiz"): CuratedByte(
        title="Which Cognitive Bias Is This?",
        content="You're more likely to believe a statement you've heard before — even if you know it's false. This is called the Illusory Truth Effect. Repeated exposure increases processing fluency, which your brain mistakes for truth. Solution: actively fact-check familiar-sounding claims. Familiarity ≠ accuracy.",
        category="Psychology",
        difficulty=0.5,
        format="quiz",
        source="mock-curator",
        tags=["psychology", "bias", "cognition"],
    ),
    ("philosophy", "beginner", "story"): CuratedByte(
        title="Socrates Never Wrote Anything Down",
        content="Everything we know about Socrates comes from his student Plato's dialogues. Socrates believed writing weakened memory and created the illusion of knowledge without understanding. He'd ask questions until his conversation partner contradicted themselves — the Socratic method. He was sentenced to death for 'corrupting the youth' by teaching them to question authority.",
        category="Philosophy",
        difficulty=0.2,
        format="story",
        source="mock-curator",
        tags=["philosophy", "socrates", "ancient"],
    ),
    ("philosophy", "advanced", "comparison"): CuratedByte(
        title="Free Will: Compatibilism vs Libertarianism",
        content="Compatibilists argue free will and determinism can coexist — you're free if you act on your own desires, even if those desires are determined. Libertarians insist true free will requires the ability to have done otherwise. The debate hinges on what 'free' means. Compatibilism defines it as 'uncoerced by external forces.' Libertarianism defines it as 'uncaused by prior states.' Same word, different definitions.",
        category="Philosophy",
        difficulty=0.8,
        format="comparison",
        source="mock-curator",
        tags=["philosophy", "free-will", "determinism"],
    ),
    ("tech", "beginner", "howto"): CuratedByte(
        title="The 80/20 Rule of Debugging",
        content="80% of bugs live in 20% of your code. Instead of reading line-by-line, add logging at decision points — function entries, branches, state changes. Run once. The bug's location reveals itself as the gap between 'last good log' and 'first bad log.' This is binary search debugging: divide the problem space in half each time. Most bugs are found in 3-5 probes.",
        category="Technology",
        difficulty=0.2,
        format="howto",
        source="mock-curator",
        tags=["tech", "debugging", "engineering"],
    ),
    ("tech", "intermediate", "comparison"): CuratedByte(
        title="SQL vs NoSQL: When to Choose What",
        content="SQL (Postgres, MySQL): use when your data has relationships (users → orders → products) and you need ACID guarantees. NoSQL (MongoDB, DynamoDB): use when your data is document-shaped, schema-flexible, and you need horizontal scale. The real question: will you query by relationships (SQL) or by document ID (NoSQL)? Most apps need both — that's why Postgres added JSONB.",
        category="Technology",
        difficulty=0.5,
        format="comparison",
        source="mock-curator",
        tags=["tech", "databases", "architecture"],
    ),
}

_MOCK_TOPICS = list(_MOCK_LIBRARY.keys())

# Additional mock content for exploration — generated on-the-fly
_MOCK_TEMPLATES = [
    CuratedByte(
        title="The Adjacent Possible",
        content="Innovation doesn't happen in leaps — it happens when existing ideas combine in new ways. The steam engine wasn't invented from nothing; it combined the kettle (ancient), the piston (1670s), and the condenser (1765). Each piece had to exist first. This is why simultaneous invention is common: Newton and Leibniz both invented calculus because all the prerequisite math was finally available. Create more adjacent possible by learning broadly, not deeply.",
        category="Innovation",
        difficulty=0.4,
        format="fact",
        source="mock-curator",
        tags=["innovation", "creativity", "history"],
    ),
    CuratedByte(
        title="The Dunning-Kruger Effect in Practice",
        content="Beginners overestimate their ability because they don't know what they don't know. Experts underestimate theirs because they assume everyone knows what they know. The peak of overconfidence hits at 'medium' competence — you know enough to be dangerous but not enough to recognize your blind spots. The fix: regularly ask 'What would prove me wrong?' and seek out people who disagree with you.",
        category="Psychology",
        difficulty=0.4,
        format="fact",
        source="mock-curator",
        tags=["psychology", "bias", "metacognition"],
    ),
    CuratedByte(
        title="How Memory Actually Works",
        content="Your brain doesn't record memories like a video camera — it reconstructs them from fragments each time you recall. Each reconstruction can modify the memory. This is why eyewitness testimony is unreliable and why you and your sibling remember childhood differently. The positive side: you can intentionally reconsolidate memories by recalling them in a new context, effectively rewriting your relationship to past events.",
        category="Neuroscience",
        difficulty=0.5,
        format="fact",
        source="mock-curator",
        tags=["neuroscience", "memory", "psychology"],
    ),
]


class Curator:
    """Generates bite-sized learning content using any OpenAI-compatible LLM.

    Falls back to a mock library when no LLM_API_KEY is set,
    so the demo works without any external dependencies.
    """

    def __init__(self, llm_config: LLMConfig = None):
        self._llm = LLMClient(llm_config) if llm_config else None
        self._mock_usage = list(_MOCK_TEMPLATES)  # copy for rotation
        self._mock_idx = 0

    @property
    def is_mock(self) -> bool:
        return self._llm is None

    def generate(
        self,
        topic: str,
        difficulty: str = "beginner",
        format_type: str = "fact",
        user_context: str = "",
    ) -> CuratedByte:
        """Generate a single micro-learning byte on the given topic.

        Args:
            topic: What to curate about (e.g., "quantum entanglement")
            difficulty: "beginner", "intermediate", or "advanced"
            format_type: "fact", "comparison", "quiz", "story", or "howto"
            user_context: What the agent knows about this user
        """
        if self.is_mock:
            return self._mock_generate(topic, difficulty, format_type)
        return self._llm_generate(topic, difficulty, format_type, user_context)

    def _mock_generate(
        self, topic: str, difficulty: str, format_type: str
    ) -> CuratedByte:
        """Use the mock library to simulate content generation."""
        diff_map = {"beginner": 0.2, "intermediate": 0.5, "advanced": 0.8}
        diff_val = diff_map.get(difficulty, 0.5)

        # Try exact match first
        key = (topic.lower(), difficulty, format_type)
        if key in _MOCK_LIBRARY:
            return _MOCK_LIBRARY[key]

        # Try topic + any difficulty
        for (t, d, f), byte in _MOCK_LIBRARY.items():
            if t == topic.lower():
                b = CuratedByte(
                    title=byte.title,
                    content=byte.content,
                    category=byte.category,
                    difficulty=diff_val,
                    format=format_type,
                    source="mock-curator",
                    tags=byte.tags,
                )
                return b

        # Rotate through template library for novel topics
        byte = self._mock_usage[self._mock_idx % len(self._mock_usage)]
        self._mock_idx += 1
        return CuratedByte(
            title=f"{topic.title()}: {byte.title}",
            content=byte.content,
            category=byte.category,
            difficulty=diff_val,
            format=format_type,
            source="mock-curator",
            tags=byte.tags,
        )

    def _llm_generate(
        self, topic: str, difficulty: str, format_type: str, user_context: str
    ) -> CuratedByte:
        """Use the LLM to generate content."""
        import openai

        difficulty_guide = {
            "beginner": "Explain like the user has no prior knowledge. Use simple analogies.",
            "intermediate": "Assume basic familiarity. Add nuance and counterpoints.",
            "advanced": "Dive into mechanisms, tradeoffs, and edge cases. Challenge assumptions.",
        }

        format_guide = {
            "fact": "Deliver a surprising, memorable fact with context. One paragraph.",
            "comparison": "Compare two concepts, approaches, or eras. Highlight what's different and why it matters.",
            "quiz": "Present a question, then reveal the answer with explanation. Make the user think first.",
            "story": "Tell a brief narrative — historical event, discovery story, or personal anecdote that teaches.",
            "howto": "Give actionable steps. Be specific. End with why this approach works.",
        }

        system_prompt = f"""You are BrainByte Curator — an AI that creates micro-learning content.

Generate ONE bite-sized learning card (a "byte") that takes ~30 seconds to read.

Topic: {topic}
Difficulty: {difficulty} — {difficulty_guide.get(difficulty, "")}
Format: {format_type} — {format_guide.get(format_type, "")}
{f"User context: {user_context}" if user_context else ""}

Rules:
- Title: 3-8 words, engaging
- Content: 2-4 sentences, dense with value, no filler
- Category: a single word or short phrase
- Tags: 3-5 relevant keywords

Respond with JSON only:
{{"title": "...", "content": "...", "category": "...", "tags": [...]}}"""

        try:
            data = self._llm.chat_json(
                system_prompt=system_prompt,
                temperature=0.8,
                max_tokens=300,
            )

            model_name = self._llm.config.model
            return CuratedByte(
                title=data.get("title", topic),
                content=data.get("content", "Content generation failed."),
                category=data.get("category", topic),
                difficulty={"beginner": 0.2, "intermediate": 0.5, "advanced": 0.8}.get(
                    difficulty, 0.5
                ),
                format=format_type,
                source=f"LLM-curated ({model_name})",
                tags=data.get("tags", [topic]),
            )
        except Exception as e:
            print(f"[curator] LLM call failed: {e}")
            return self._mock_generate(topic, difficulty, format_type)

    def generate_batch(
        self, topics: list[tuple[str, str, str]], user_context: str = ""
    ) -> list[CuratedByte]:
        """Generate multiple bytes. Uses mock mode efficiently."""
        return [self.generate(t, d, f, user_context) for t, d, f in topics]
