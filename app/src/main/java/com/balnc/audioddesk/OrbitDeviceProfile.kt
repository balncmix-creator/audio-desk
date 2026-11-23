package com.balnc.audioddesk

/**
 * Small, privacy-preserving compatibility profile for Orbit's dial layout.
 * The browser gets only a fixed profile token, not the handset model, serial,
 * Android ID, or any other user/device identifier.
 */
internal object OrbitDeviceProfile {
    fun classify(manufacturer: String, model: String, device: String): String {
        val samsung = manufacturer.equals("samsung", ignoreCase = true)
        val a73Model = model.trim().startsWith("SM-A736", ignoreCase = true)
        val a73Device = device.trim().startsWith("a73", ignoreCase = true)
        return if (samsung && (a73Model || a73Device)) "galaxy-a73" else "generic"
    }
}
