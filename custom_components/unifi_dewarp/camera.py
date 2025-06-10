"""Camera platform for the UniFi Protect Dewarp integration."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.camera import Camera, CameraEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.device_registry import DeviceInfo

# This will use the already configured unifiprotect integration data
from homeassistant.components.unifiprotect.data import ProtectData

DOMAIN = "unifi_dewarp"
_LOGGER = logging.getLogger(__name__)

# This assumes you have the official UniFi Protect integration installed and configured.
# We will leverage its existing connection and data coordinator.
async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the UniFi Protect camera platform."""

    # Get the ProtectData object from the existing UniFi Protect integration
    # This is a much better approach than re-authenticating.
    try:
        # The domain for the official integration is 'unifiprotect'
        protect_data: ProtectData = hass.data["unifiprotect"][entry.entry_id]
    except KeyError:
        _LOGGER.error("UniFi Protect integration not found or not configured for this entry.")
        return

    nvr = protect_data.api

    # Find cameras that are the AI 360 model
    dewarp_cameras = [
        UnifiDewarpCamera(nvr, camera)
        for camera in nvr.bootstrap.cameras.values()
        if camera.model == "UVC-AI-360"
    ]

    if not dewarp_cameras:
        _LOGGER.info("No UniFi AI 360 cameras found.")
        return

    async_add_entities(dewarp_cameras)


class UnifiDewarpCamera(Camera):
    """A camera implementation for UniFi Protect AI 360 cameras."""

    _attr_has_entity_name = True
    _attr_should_poll = False  # Updates are pushed from the coordinator

    def __init__(self, nvr, camera):
        """Initialize the camera."""
        super().__init__()
        self.nvr = nvr
        self._camera = camera
        self._attr_unique_id = f"{self._camera.id}_dewarp"
        self._attr_name = f"{self._camera.name} Dewarp"
        self._attr_supported_features = CameraEntityFeature.STREAM

    @property
    def device_info(self) -> DeviceInfo:
        """Return device information for this camera."""
        return DeviceInfo(
            identifiers={(DOMAIN, self._camera.id)},
            name=self.name,
            manufacturer="Ubiquiti",
            model=self._camera.model,
            sw_version=str(self._camera.firmware_version),
            via_device=(DOMAIN, self.nvr.bootstrap.nvr.id),
        )

    async def async_camera_image(
        self, width: int | None = None, height: int | None = None
    ) -> bytes | None:
        """Return a still image from the camera."""
        return await self._camera.get_snapshot(width, height)

    async def stream_source(self) -> str | None:
        """Return the stream source for the camera."""
        # We will use the highest quality RTSPS stream
        channel = self._camera.channels[0]
        return await self._camera.get_stream_url(channel.id)

    @property
    def is_recording(self) -> bool:
        """Return true if the camera is recording."""
        return self._camera.is_recording
