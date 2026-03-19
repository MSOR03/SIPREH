"""
Servicio de resumen con IA para predicciones de sequia.
Usa Groq API con modelo llama-3.1-8b-instant.
"""
import logging
import requests
from typing import Dict, List, Optional, Any

from app.core.config import settings

logger = logging.getLogger("ai_summary")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.1-8b-instant"


def _call_groq(system_prompt: str, user_prompt: str) -> str:
    """Llama a Groq API y retorna el texto de respuesta."""
    api_key = settings.GROQ_API_KEY
    if not api_key:
        return "Error: GROQ_API_KEY no configurada en el servidor."

    try:
        response = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
                "max_tokens": 300,
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()
    except requests.HTTPError as e:
        logger.error("Groq API HTTP error: %s - %s", e.response.status_code, e.response.text)
        return f"Error al consultar IA: {e.response.status_code}"
    except Exception as e:
        logger.error("Groq API error: %s", str(e))
        return f"Error al consultar IA: {str(e)}"


SYSTEM_PROMPT = (
    "Eres un experto en analisis de sequia y climatologia. "
    "Respondes en espanol de forma concisa y clara, en maximo 2-3 oraciones. "
    "No uses markdown, emojis ni listas. Solo texto plano descriptivo."
)


def generate_1d_summary(
    index: str,
    scale: int,
    values: List[float],
) -> str:
    """
    Genera resumen de la serie temporal de prediccion (12 horizontes).
    Analiza tendencia, intensidad y persistencia.
    """
    user_prompt = (
        f"Analiza esta prediccion de sequia. "
        f"Indice: {index}, Escala: {scale} meses. "
        f"Valores por horizonte (1 a {len(values)} meses): {values}. "
        f"Describe brevemente: 1) tendencia (mejorando/empeorando), "
        f"2) intensidad (leve/moderada/severa), "
        f"3) persistencia (cuantos meses en sequia)."
    )
    return _call_groq(SYSTEM_PROMPT, user_prompt)


def generate_2d_summary(
    index: str,
    scale: int,
    horizon: int,
    grid_summary: Dict[str, Any],
) -> str:
    """
    Genera resumen del grid espacial (297 celdas).
    Analiza extension espacial, severidad y distribucion.
    """
    mean_val = grid_summary.get('mean')
    mean_str = f"{mean_val:.2f}" if isinstance(mean_val, (int, float)) else "N/A"
    user_prompt = (
        f"Analiza este mapa de prediccion de sequia. "
        f"Indice: {index}, Escala: {scale} meses, Horizonte: {horizon} meses. "
        f"Resumen del grid: media={mean_str}, "
        f"min={grid_summary.get('min', 'N/A')}, max={grid_summary.get('max', 'N/A')}, "
        f"% severo={grid_summary.get('pct_severe', 0)}%, "
        f"% moderado={grid_summary.get('pct_moderate', 0)}%, "
        f"% normal={grid_summary.get('pct_normal', 0)}%. "
        f"Describe brevemente la condicion espacial: extension de la sequia, "
        f"severidad predominante y que tan homogenea es la distribucion."
    )
    return _call_groq(SYSTEM_PROMPT, user_prompt)
