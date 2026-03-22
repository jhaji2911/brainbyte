package com.rustypashi.bbyte

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class UsageStatsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "UsageStatsModule"

    // Required by NativeEventEmitter on the JS side
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    @ReactMethod
    fun hasUsageStatsPermission(promise: Promise) {
        try {
            promise.resolve(checkPermission())
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestUsageStatsPermission() {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun requestOverlayPermission() {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:${reactContext.packageName}")
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            reactContext.startActivity(intent)
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun startMonitoring(intervalMs: Double, cooldownMs: Double, poisonApps: ReadableArray) {
        try {
            val apps = ArrayList<String>()
            for (i in 0 until poisonApps.size()) {
                poisonApps.getString(i)?.let { apps.add(it) }
            }
            val intent = Intent(reactContext, AppMonitorService::class.java).apply {
                putExtra("intervalMs", intervalMs.toLong())
                putExtra("cooldownMs", cooldownMs.toLong())
                putStringArrayListExtra("poisonApps", apps)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
        } catch (e: Exception) {
            // Not surfaced to JS — service start failure is non-fatal
        }
    }

    @ReactMethod
    fun stopMonitoring() {
        try {
            val intent = Intent(reactContext, AppMonitorService::class.java)
            reactContext.stopService(intent)
        } catch (_: Exception) {}
    }

    @ReactMethod
    fun triggerTestOverlay() {
        try {
            val intent = Intent(reactContext, AppMonitorService::class.java).apply {
                action = AppMonitorService.ACTION_TEST_OVERLAY
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
        } catch (_: Exception) {}
    }

    private fun checkPermission(): Boolean {
        val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                reactContext.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                reactContext.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }
}
