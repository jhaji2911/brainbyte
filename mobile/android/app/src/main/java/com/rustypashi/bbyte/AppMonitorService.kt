package com.rustypashi.bbyte

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class AppMonitorService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false
    private var intervalMs: Long = 15_000L
    private var cooldownMs: Long = 15 * 60 * 1000L
    private var poisonApps: List<String> = DEFAULT_DISTRACTION_APPS
    private var lastInterruptTime: Long = 0L
    private var currentOverlayView: View? = null
    private var windowManager: WindowManager? = null
    // Animatable views kept as fields so showOverlay can start animation post-layout
    private var breathCircleView: View? = null
    private var breathRingView: View? = null
    private var breathPhaseLabel: TextView? = null

    private var breathAnimator: Animator? = null
    private val autoDismissRunnable = Runnable { dismissOverlay() }

    companion object {
        const val SERVICE_CHANNEL_ID = "bbyte_monitor_service"
        const val INTERRUPT_CHANNEL_ID = "bbyte_interrupts"
        const val SERVICE_NOTIFICATION_ID = 1001
        const val INTERRUPT_NOTIFICATION_ID = 1002
        const val ACTION_TEST_OVERLAY = "com.rustypashi.bbyte.ACTION_TEST_OVERLAY"

        val DEFAULT_DISTRACTION_APPS = listOf(
            "com.instagram.android",
            "com.zhiliaoapp.musically",      // TikTok
            "com.ss.android.ugc.trill",       // TikTok (some regions)
            "com.reddit.frontpage",
            "com.twitter.android",
            "com.snapchat.android",
            "com.facebook.katana",
            "com.google.android.youtube",
        )
    }

    private val checkRunnable = object : Runnable {
        override fun run() {
            checkForegroundApp()
            handler.postDelayed(this, intervalMs)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Test trigger: show the overlay immediately without waiting for detection
        if (intent?.action == ACTION_TEST_OVERLAY) {
            createNotificationChannels()
            if (!isRunning) startForeground(SERVICE_NOTIFICATION_ID, buildServiceNotification())
            if (Settings.canDrawOverlays(this)) handler.post { showOverlay() }
            return START_STICKY
        }

        intent?.let {
            intervalMs = it.getLongExtra("intervalMs", 15_000L)
            cooldownMs = it.getLongExtra("cooldownMs", 15 * 60 * 1000L)
            it.getStringArrayListExtra("poisonApps")?.let { apps ->
                if (apps.isNotEmpty()) poisonApps = apps
            }
        }

        isRunning = true
        createNotificationChannels()
        startForeground(SERVICE_NOTIFICATION_ID, buildServiceNotification())
        handler.post(checkRunnable)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(checkRunnable)
        dismissOverlay()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ──────────────────────────────────────────────────────────────
    // Core detection
    // ──────────────────────────────────────────────────────────────

    private fun checkForegroundApp() {
        val now = System.currentTimeMillis()
        if (now - lastInterruptTime < cooldownMs) return

        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return
        val stats = usm.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            now - 30_000,
            now
        ) ?: return

        val topPackage = stats.maxByOrNull { it.lastTimeUsed }?.packageName ?: return

        if (poisonApps.contains(topPackage) && topPackage != packageName) {
            lastInterruptTime = now
            onDistractionDetected(topPackage)
        }
    }

    private fun onDistractionDetected(detectedPackage: String) {
        // 1. Fire event to React Native JS runtime (works because foreground service
        //    keeps the app process alive even while Instagram is in focus)
        sendEventToRN(detectedPackage)

        // 2. Show system overlay if permission granted
        if (Settings.canDrawOverlays(this)) {
            handler.post { showOverlay() }
        }

        // 3. Always fire a notification as fallback
        sendInterruptNotification()
    }

    // ──────────────────────────────────────────────────────────────
    // React Native event emission
    // ──────────────────────────────────────────────────────────────

    private fun sendEventToRN(detectedPackage: String) {
        try {
            val app = applicationContext as? ReactApplication ?: return
            val reactContext =
                app.reactNativeHost.reactInstanceManager.currentReactContext ?: return
            val params = Arguments.createMap().apply {
                putString("packageName", detectedPackage)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onDistractionDetected", params)
        } catch (_: Exception) {}
    }

    // ──────────────────────────────────────────────────────────────
    // System overlay (drawn over the distraction app)
    // ──────────────────────────────────────────────────────────────

    private fun showOverlay() {
        if (currentOverlayView != null) return // already showing

        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        windowManager = wm

        // Full-screen, touch-blocking overlay — no FLAG_NOT_FOCUSABLE so all
        // touches are consumed and Instagram cannot be interacted with.
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS,
            PixelFormat.TRANSLUCENT
        )

        val overlay = buildFullScreenOverlay()

        // Auto-dismiss after 60 s if the user does nothing
        handler.postDelayed(autoDismissRunnable, 60_000)

        try {
            wm.addView(overlay, params)
            currentOverlayView = overlay
            // Start animation only after the view has a real layout pass and window token.
            // overlay.post() runs on the next Choreographer frame, after measure/layout.
            overlay.post {
                val c = breathCircleView ?: return@post
                val r = breathRingView   ?: return@post
                val p = breathPhaseLabel ?: return@post
                startBreathAnimation(c, r, p)
            }
        } catch (_: Exception) {}
    }

    private fun buildFullScreenOverlay(): FrameLayout {
        // Colors mirrored from src/theme.ts
        val primary     = Color.parseColor("#b6a0ff")  // COLORS.primary
        val primaryDim  = Color.parseColor("#8b6dff")  // COLORS.primaryDim
        val onSurface   = Color.parseColor("#f0f0f0")  // COLORS.onSurface
        val onVariant   = Color.parseColor("#888888")  // COLORS.onSurfaceVariant
        val black       = Color.parseColor("#FF000000")

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#F0020202")) // near-black, 94% opaque
        }

        // ── Close button — top right ──────────────────────────────
        val closeBtn = TextView(this).apply {
            text = "✕"
            setTextColor(onVariant)
            textSize = 22f
            setPadding(dp(24), dp(52), dp(24), dp(20))
            setOnClickListener { dismissOverlay() }
        }
        root.addView(closeBtn, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.TOP or Gravity.END
        ))

        // ── Centered vertical column ───────────────────────────────
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(32), 0, dp(32), dp(56))
        }

        val header = TextView(this).apply {
            text = "🧠  BrainByte"
            setTextColor(primary)
            textSize = 15f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            letterSpacing = 0.12f
        }
        val tagline = TextView(this).apply {
            text = "Replace this scroll with something real"
            setTextColor(onVariant)
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(44))
        }

        // ── Breathing circle ───────────────────────────────────────
        val circleSize = dp(200)
        val innerSize  = dp(110)
        val circleFrame = FrameLayout(this)

        val ringView = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.TRANSPARENT)
                setStroke(dp(2), Color.parseColor("#558b6dff"))
            }
        }
        val circleView = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#22b6a0ff"))
                setStroke(dp(2), primary)
            }
        }
        circleFrame.addView(ringView,   FrameLayout.LayoutParams(circleSize, circleSize, Gravity.CENTER))
        circleFrame.addView(circleView, FrameLayout.LayoutParams(innerSize,  innerSize,  Gravity.CENTER))

        // Store refs so showOverlay can kick off animation after layout
        breathCircleView = circleView
        breathRingView   = ringView

        val phaseLabel = TextView(this).apply {
            text = "Breathe In..."
            setTextColor(onSurface)
            textSize = 20f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(0, dp(28), 0, dp(52))
        }
        breathPhaseLabel = phaseLabel

        // ── Buttons ────────────────────────────────────────────────
        val ctaBtn = TextView(this).apply {
            text = "Open BrainByte & Learn  →"
            setTextColor(black)
            textSize = 15f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(dp(20), dp(16), dp(20), dp(16))
            background = GradientDrawable().apply {
                setColor(primary)
                cornerRadius = dp(50).toFloat()
            }
            setOnClickListener { dismissOverlay(); launchBrainByte() }
        }
        val ctaParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(12) }

        val continueBtn = TextView(this).apply {
            text = "Continue scrolling"
            setTextColor(onVariant)
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding(dp(20), dp(12), dp(20), dp(12))
            setOnClickListener { dismissOverlay() }
        }

        col.addView(header)
        col.addView(tagline)
        col.addView(circleFrame, LinearLayout.LayoutParams(circleSize, circleSize).apply {
            gravity = Gravity.CENTER_HORIZONTAL
        })
        col.addView(phaseLabel)
        col.addView(ctaBtn, ctaParams)
        col.addView(continueBtn, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        root.addView(col, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        ))

        // Animation is started by showOverlay() via overlay.post{} after wm.addView
        return root
    }

    /** Animate breathe-in → hold → breathe-out in a continuous cycle. */
    private fun startBreathAnimation(circle: View, ring: View, phaseLabel: TextView) {
        val primaryColor  = Color.parseColor("#b6a0ff")  // breathe in — purple
        val holdColor     = Color.parseColor("#f0f0f0")  // hold — near-white
        val outColor      = Color.parseColor("#888888")  // breathe out — gray

        fun runCycle() {
            if (currentOverlayView == null) return

            // Breathe In — 4 s
            handler.post {
                phaseLabel.text = "Breathe In..."
                phaseLabel.setTextColor(primaryColor)
            }
            val inSet = AnimatorSet().apply {
                playTogether(
                    ObjectAnimator.ofFloat(circle, "scaleX", 0.55f, 1.0f).apply { duration = 4000 },
                    ObjectAnimator.ofFloat(circle, "scaleY", 0.55f, 1.0f).apply { duration = 4000 },
                    ObjectAnimator.ofFloat(ring,   "scaleX", 0.65f, 1.3f).apply { duration = 4000 },
                    ObjectAnimator.ofFloat(ring,   "scaleY", 0.65f, 1.3f).apply { duration = 4000 },
                    ObjectAnimator.ofFloat(ring,   "alpha",  0.2f,  0.9f).apply { duration = 4000 }
                )
            }
            inSet.addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    if (currentOverlayView == null) return
                    // Hold — 2 s
                    handler.post {
                        phaseLabel.text = "Hold."
                        phaseLabel.setTextColor(holdColor)
                    }
                    handler.postDelayed({
                        if (currentOverlayView == null) return@postDelayed
                        // Breathe Out — 4 s
                        handler.post {
                            phaseLabel.text = "Breathe Out..."
                            phaseLabel.setTextColor(outColor)
                        }
                        val outSet = AnimatorSet().apply {
                            playTogether(
                                ObjectAnimator.ofFloat(circle, "scaleX", 1.0f, 0.55f).apply { duration = 4000 },
                                ObjectAnimator.ofFloat(circle, "scaleY", 1.0f, 0.55f).apply { duration = 4000 },
                                ObjectAnimator.ofFloat(ring,   "scaleX", 1.3f, 0.65f).apply { duration = 4000 },
                                ObjectAnimator.ofFloat(ring,   "scaleY", 1.3f, 0.65f).apply { duration = 4000 },
                                ObjectAnimator.ofFloat(ring,   "alpha",  0.9f, 0.2f).apply  { duration = 4000 }
                            )
                        }
                        outSet.addListener(object : AnimatorListenerAdapter() {
                            override fun onAnimationEnd(animation: Animator) {
                                if (currentOverlayView == null) return
                                handler.postDelayed({ runCycle() }, 500)
                            }
                        })
                        breathAnimator = outSet
                        outSet.start()
                    }, 2000)
                }
            })
            breathAnimator = inSet
            inSet.start()
        }

        runCycle()
    }

    private fun dismissOverlay() {
        handler.removeCallbacks(autoDismissRunnable)
        breathAnimator?.cancel()
        breathAnimator = null
        breathCircleView = null
        breathRingView   = null
        breathPhaseLabel = null
        currentOverlayView?.let {
            try {
                windowManager?.removeView(it)
            } catch (_: Exception) {}
            currentOverlayView = null
        }
    }

    private fun launchBrainByte() {
        try {
            val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("showInterrupt", true)
            }
            if (intent != null) startActivity(intent)
        } catch (_: Exception) {}
    }

    private fun dp(v: Int): Int =
        (v * resources.displayMetrics.density).toInt()

    // ──────────────────────────────────────────────────────────────
    // Notifications
    // ──────────────────────────────────────────────────────────────

    private fun sendInterruptNotification() {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("showInterrupt", true)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, INTERRUPT_NOTIFICATION_ID, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, INTERRUPT_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("🧠 BrainByte — time to swap the scroll")
            .setContentText("Tap to open and breathe for a moment.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(INTERRUPT_NOTIFICATION_ID, notification)
    }

    private fun buildServiceNotification(): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("BrainByte")
            .setContentText("Protecting your focus")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun createNotificationChannels() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        nm.createNotificationChannel(
            NotificationChannel(
                SERVICE_CHANNEL_ID,
                "BrainByte Focus Monitor",
                NotificationManager.IMPORTANCE_MIN
            ).apply { description = "Quietly watching for doomscrolling" }
        )

        nm.createNotificationChannel(
            NotificationChannel(
                INTERRUPT_CHANNEL_ID,
                "BrainByte Learning Nudges",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Nudges to replace a scroll with a brain byte"
                enableLights(true)
                lightColor = Color.parseColor("#B0FF42")
            }
        )
    }
}
