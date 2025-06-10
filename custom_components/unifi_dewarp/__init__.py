"""The UniFi Protect Dewarp Camera integration."""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.network import get_url
from homeassistant.components.http import StaticPathConfig

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["camera"]
DOMAIN = "unifi_dewarp"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up UniFi Protect Dewarp from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    # Register the custom card
    # This makes the unifi-dewarp-card.js file available at /hacsfiles/unifi_dewarp/unifi-dewarp-card.js
    await hass.http.async_register_static_path(
        StaticPathConfig(
            f"/hacsfiles/{DOMAIN}",
            hass.config.path(f"custom_components/{DOMAIN}/www"),
            cache_headers=False,
        )
    )

    # Forward the setup to the camera platform.
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
