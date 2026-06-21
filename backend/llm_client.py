"""
BrainByte LLM Client — Generic adapter for any OpenAI-compatible API.
======================================================================
Supports any provider that speaks the /v1/chat/completions protocol:
OpenAI, Groq, Together AI, Ollama (local), OpenRouter, Fireworks, etc.

Configure via environment:
  LLM_API_KEY   — your API key (required for non-mock mode)
  LLM_BASE_URL  — provider endpoint (default: https://api.openai.com/v1)
  LLM_MODEL     — model name (default: gpt-4o-mini)

If LLM_API_KEY is not set, falls back to mock mode.
"""

import json
import os
from dataclasses import dataclass
from typing import Optional

import httpx


@dataclass
class LLMConfig:
    api_key: str
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o-mini"


def load_llm_config() -> Optional[LLMConfig]:
    """Load LLM config from environment variables."""
    api_key = os.environ.get("LLM_API_KEY")
    if not api_key:
        return None
    return LLMConfig(
        api_key=api_key,
        base_url=os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1"),
        model=os.environ.get("LLM_MODEL", "gpt-4o-mini"),
    )


class LLMClient:
    """Thin wrapper around any OpenAI-compatible chat completions API."""

    def __init__(self, config: LLMConfig):
        self.config = config
        self._client = httpx.Client(timeout=30.0)

    def chat(
        self,
        system_prompt: str,
        user_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 300,
        json_mode: bool = False,
    ) -> str:
        """Send a chat completion request. Returns the response text."""
        messages = [{"role": "system", "content": system_prompt}]
        if user_prompt:
            messages.append({"role": "user", "content": user_prompt})

        body = {
            "model": self.config.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

        url = f"{self.config.base_url.rstrip('/')}/chat/completions"
        resp = self._client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    def chat_json(
        self,
        system_prompt: str,
        user_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 300,
    ) -> dict:
        """Chat with JSON response parsing."""
        text = self.chat(
            system_prompt, user_prompt, temperature, max_tokens, json_mode=True
        )
        return json.loads(text)

    def close(self):
        self._client.close()
