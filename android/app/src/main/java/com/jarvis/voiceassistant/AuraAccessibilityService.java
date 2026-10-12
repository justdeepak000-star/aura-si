package com.jarvis.voiceassistant;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * AURA GUI Operator: reads the on-screen element tree, dispatches real touch
 * gestures and shows a "Ghost Touch" ripple where AURA taps.
 */
public class AuraAccessibilityService extends AccessibilityService {

    public static AuraAccessibilityService instance;
    private final Handler main = new Handler(Looper.getMainLooper());
    private GhostView ghost;
    private View pillHit;
    /** Set by a double-tap on the floating task pill — running tasks must stop. */
    public static volatile boolean cancelled = false;
    private long lastTap = 0;
    private final List<AccessibilityNodeInfo> lastNodes = new ArrayList<>();

    @Override protected void onServiceConnected() { instance = this; addGhost(); }
    @Override public void onAccessibilityEvent(AccessibilityEvent e) {}
    @Override public void onInterrupt() {}
    @Override public void onDestroy() { instance = null; super.onDestroy(); }

    // ───────── Screen reading ─────────
    public synchronized JSONObject readScreen() throws Exception {
        lastNodes.clear();
        JSONArray arr = new JSONArray();
        AccessibilityNodeInfo root = getRootInActiveWindow();
        String pkg = root != null && root.getPackageName() != null ? root.getPackageName().toString() : "";
        boolean secure = false;
        if (root != null) secure = walk(root, arr, 0);
        DisplayMetrics dm = getResources().getDisplayMetrics();
        JSONObject o = new JSONObject();
        o.put("package", pkg);
        o.put("width", dm.widthPixels);
        o.put("height", dm.heightPixels);
        o.put("secure", secure);
        o.put("cancelled", cancelled);
        o.put("nodes", arr);
        return o;
    }

    private boolean walk(AccessibilityNodeInfo n, JSONArray arr, int depth) throws Exception {
        if (n == null || depth > 40 || arr.length() > 180) return false;
        boolean secure = n.isPassword();
        if (n.isVisibleToUser()) {
            String text = n.getText() != null ? n.getText().toString() : "";
            String desc = n.getContentDescription() != null ? n.getContentDescription().toString() : "";
            String hint = (android.os.Build.VERSION.SDK_INT >= 26 && n.getHintText() != null) ? n.getHintText().toString() : "";
            boolean useful = n.isClickable() || n.isEditable() || n.isScrollable() || !text.isEmpty() || !desc.isEmpty();
            if (useful) {
                Rect r = new Rect(); n.getBoundsInScreen(r);
                if (r.width() > 0 && r.height() > 0) {
                    JSONObject j = new JSONObject();
                    j.put("i", lastNodes.size());
                    if (n.isPassword()) j.put("t", "[hidden]");
                    else if (!text.isEmpty()) j.put("t", text.length() > 80 ? text.substring(0, 80) : text);
                    if (!desc.isEmpty()) j.put("d", desc.length() > 60 ? desc.substring(0, 60) : desc);
                    if (!hint.isEmpty()) j.put("h", hint);
                    String cls = n.getClassName() != null ? n.getClassName().toString() : "";
                    j.put("c", cls.substring(cls.lastIndexOf('.') + 1));
                    if (n.isClickable()) j.put("click", true);
                    if (n.isEditable()) j.put("edit", true);
                    if (n.isScrollable()) j.put("scroll", true);
                    if (n.isPassword() || (n.getInputType() & InputType.TYPE_NUMBER_VARIATION_PASSWORD) != 0) j.put("pwd", true);
                    j.put("b", new JSONArray(new int[]{r.left, r.top, r.right, r.bottom}));
                    arr.put(j);
                    lastNodes.add(n);
                }
            }
        }
        for (int k = 0; k < n.getChildCount(); k++) secure |= walk(n.getChild(k), arr, depth + 1);
        return secure;
    }

    private AccessibilityNodeInfo node(int i) { return i >= 0 && i < lastNodes.size() ? lastNodes.get(i) : null; }

    // ───────── Actions ─────────
    public boolean tapNode(int i) {
        AccessibilityNodeInfo n = node(i);
        if (n == null) return false;
        Rect r = new Rect(); n.getBoundsInScreen(r);
        // Real finger touch first (custom views like WhatsApp ignore virtual clicks)
        if (tap(r.centerX(), r.centerY())) return true;
        AccessibilityNodeInfo c = n;
        while (c != null && !c.isClickable()) c = c.getParent();
        return c != null && c.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }

    public boolean tap(float x, float y) {
        Path p = new Path(); p.moveTo(x, y); p.lineTo(x + 1, y + 1);
        ripple(x, y);
        return dispatch(new GestureDescription.StrokeDescription(p, 0, 100));
    }

    public boolean longPress(float x, float y) {
        Path p = new Path(); p.moveTo(x, y);
        ripple(x, y);
        return dispatch(new GestureDescription.StrokeDescription(p, 0, 700));
    }

    public boolean swipe(float x1, float y1, float x2, float y2, long ms) {
        Path p = new Path(); p.moveTo(x1, y1); p.lineTo(x2, y2);
        trail(x1, y1, x2, y2);
        return dispatch(new GestureDescription.StrokeDescription(p, 0, Math.max(120, ms)));
    }

    public boolean scroll(String dir) {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        float w = dm.widthPixels, h = dm.heightPixels, cx = w / 2, cy = h / 2;
        switch (dir) {
            case "up": return swipe(cx, h * 0.3f, cx, h * 0.75f, 350);
            case "left": return swipe(w * 0.2f, cy, w * 0.8f, cy, 300);
            case "right": return swipe(w * 0.8f, cy, w * 0.2f, cy, 300);
            default: return swipe(cx, h * 0.75f, cx, h * 0.3f, 350);
        }
    }

    public boolean typeText(int i, String text) {
        AccessibilityNodeInfo n = i >= 0 ? node(i) : null;
        if (n == null) {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root != null) n = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        }
        if (n == null) return false;
        if (n.isPassword()) return false; // never type secrets
        n.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
        n.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        Bundle b = new Bundle();
        b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
        boolean ok = n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b);
        Rect r = new Rect(); n.getBoundsInScreen(r); ripple(r.centerX(), r.centerY());
        return ok;
    }

    public boolean submitIme() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        AccessibilityNodeInfo f = root != null ? root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) : null;
        if (f != null && android.os.Build.VERSION.SDK_INT >= 30) {
            return f.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.getId());
        }
        return false;
    }

    public boolean clickText(String label) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null || label == null) return false;
        List<AccessibilityNodeInfo> found = root.findAccessibilityNodeInfosByText(label);
        for (AccessibilityNodeInfo n : found) {
            AccessibilityNodeInfo c = n;
            while (c != null && !c.isClickable()) c = c.getParent();
            if (c != null) {
                Rect r = new Rect(); n.getBoundsInScreen(r); ripple(r.centerX(), r.centerY());
                if (c.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true;
            }
        }
        return false;
    }

    public boolean global(int action) { return performGlobalAction(action); }

    /** Finds the Send button (icon or text) in WhatsApp, SMS and Gmail and presses it. */
    public boolean clickSend() {
        List<AccessibilityNodeInfo> roots = new ArrayList<>();
        try {
            for (android.view.accessibility.AccessibilityWindowInfo w : getWindows()) {
                if (w.getType() == android.view.accessibility.AccessibilityWindowInfo.TYPE_INPUT_METHOD) continue;
                AccessibilityNodeInfo r = w.getRoot();
                if (r != null) roots.add(r);
            }
        } catch (Exception ignored) {}
        AccessibilityNodeInfo active = getRootInActiveWindow();
        if (active != null) roots.add(0, active);
        for (AccessibilityNodeInfo root : roots) {
            String pkg = root.getPackageName() != null ? root.getPackageName().toString() : "";
            if (pkg.equals(getPackageName())) continue;
            String[] ids = { pkg + ":id/send", pkg + ":id/send_button", pkg + ":id/send_action", pkg + ":id/send_message_button_icon",
                pkg + ":id/send_message_button", pkg + ":id/compose_send", pkg + ":id/send_message_button_container", pkg + ":id/ib_send" };
            for (String id : ids) {
                for (AccessibilityNodeInfo n : root.findAccessibilityNodeInfosByViewId(id)) if (n.isVisibleToUser() && press(n)) return true;
            }
            AccessibilityNodeInfo hit = findSend(root, 0);
            if (hit != null && press(hit)) return true;
        }
        return false;
    }

    private static boolean isSendLabel(String s) {
        if (s.isEmpty() || s.length() > 60) return false;
        if (s.contains("schedule") || s.contains("later") || s.contains("feedback") || s.contains("location") || s.contains("money")) return false;
        return s.equals("send") || s.startsWith("send ") || s.startsWith("send,") || s.contains("send message") || s.contains("send sms")
            || s.contains("send rcs") || s.contains("send mms") || s.contains("send encrypted") || s.contains("end-to-end encrypted message")
            || s.equals("పంపు") || s.equals("పంపండి") || s.contains("पंपु") || s.equals("भेजें") || s.equals("sms") || s.equals("mms");
    }

    private AccessibilityNodeInfo findSend(AccessibilityNodeInfo n, int d) {
        if (n == null || d > 50) return null;
        String desc = n.getContentDescription() != null ? n.getContentDescription().toString().trim().toLowerCase() : "";
        String text = n.getText() != null ? n.getText().toString().trim().toLowerCase() : "";
        String id = n.getViewIdResourceName() != null ? n.getViewIdResourceName().toLowerCase() : "";
        boolean idHit = id.endsWith("/send") || id.contains("send_button") || id.contains("send_message") || id.contains("compose_send");
        if (n.isVisibleToUser() && !n.isEditable() && (isSendLabel(desc) || isSendLabel(text) || idHit)) return n;
        for (int k = 0; k < n.getChildCount(); k++) { AccessibilityNodeInfo r = findSend(n.getChild(k), d + 1); if (r != null) return r; }
        return null;
    }

    /** Accessibility click on the clickable ancestor; real finger tap as a backup. */
    private boolean press(AccessibilityNodeInfo n) {
        Rect r = new Rect(); n.getBoundsInScreen(r);
        AccessibilityNodeInfo c = n;
        while (c != null && !c.isClickable()) c = c.getParent();
        boolean clicked = c != null && c.isEnabled() && c.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        if (clicked) { ripple(r.centerX(), r.centerY()); return true; }
        return r.width() > 0 && r.height() > 0 && tap(r.centerX(), r.centerY());
    }

    /** True when the compose box still holds text (send didn't happen yet). */
    private boolean composeHasText() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        AccessibilityNodeInfo f = root != null ? root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT) : null;
        if (f == null || f.getText() == null) return false;
        String pkg = root.getPackageName() != null ? root.getPackageName().toString() : "";
        if (pkg.contains("com.google.android.gm")) return false; // Gmail body field stays filled until screen closes
        return f.getText().toString().trim().length() > 0 && (f.getHintText() == null || !f.getText().toString().equals(f.getHintText().toString()));
    }

    /** Retry clickSend for several seconds (apps load slowly), then bring AURA back. */
    public void autoSendAndReturn() {
        final int[] tries = {0};
        Runnable[] job = new Runnable[1];
        job[0] = () -> {
            boolean ok = clickSend();
            if (!ok && ++tries[0] < 14) { main.postDelayed(job[0], 700); return; }
            main.postDelayed(this::returnToAura, ok ? 1800 : 300);
        };
        main.postDelayed(job[0], 1800);
    }

    public void returnToAura() {
        try {
            android.content.Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (i != null) { i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT); startActivity(i); }
        } catch (Exception ignored) {}
    }

    private boolean dispatch(GestureDescription.StrokeDescription s) {
        GestureDescription g = new GestureDescription.Builder().addStroke(s).build();
        return dispatchGesture(g, null, null);
    }

    // ───────── Ghost Touch overlay ─────────
    private void addGhost() {
        main.post(() -> {
            try {
                WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
                ghost = new GhostView(this);
                WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT);
                wm.addView(ghost, lp);
                // Touchable strip over the status pill: double-tap = emergency cancel
                pillHit = new View(this);
                pillHit.setVisibility(View.GONE);
                pillHit.setOnTouchListener((v, ev) -> {
                    if (ev.getAction() == android.view.MotionEvent.ACTION_UP) {
                        long now = System.currentTimeMillis();
                        if (now - lastTap < 400) { cancelled = true; setStatus(""); main.removeCallbacksAndMessages(null); returnToAura(); }
                        lastTap = now;
                    }
                    return true;
                });
                WindowManager.LayoutParams hp = new WindowManager.LayoutParams(
                    (int) (getResources().getDisplayMetrics().widthPixels * 0.8f), 110,
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT);
                hp.gravity = android.view.Gravity.TOP | android.view.Gravity.CENTER_HORIZONTAL;
                hp.y = 70;
                wm.addView(pillHit, hp);
            } catch (Exception ignored) {}
        });
    }

    private void ripple(float x, float y) { main.post(() -> { if (ghost != null) ghost.ripple(x, y); }); }
    private void trail(float a, float b, float c, float d) { main.post(() -> { if (ghost != null) ghost.trail(a, b, c, d); }); }

    public void setStatus(String s) {
        if (s != null && !s.isEmpty()) cancelled = false;
        main.post(() -> {
            if (ghost != null) ghost.status(s);
            if (pillHit != null) pillHit.setVisibility(s == null || s.isEmpty() ? View.GONE : View.VISIBLE);
        });
    }

    static class GhostView extends View {
        float x = -1, y = -1, p = 1; float[] tr; String label = "";
        final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG), dot = new Paint(Paint.ANTI_ALIAS_FLAG), txt = new Paint(Paint.ANTI_ALIAS_FLAG), pill = new Paint(Paint.ANTI_ALIAS_FLAG);
        GhostView(Context c) {
            super(c);
            ring.setStyle(Paint.Style.STROKE); ring.setStrokeWidth(6); ring.setColor(Color.rgb(150, 160, 255));
            dot.setColor(Color.argb(170, 200, 210, 255));
            txt.setColor(Color.WHITE); txt.setTextSize(34);
            pill.setColor(Color.argb(200, 15, 18, 35));
        }
        void ripple(float nx, float ny) { x = nx; y = ny; tr = null; animateP(); }
        void trail(float a, float b, float c, float d) { tr = new float[]{a, b, c, d}; x = c; y = d; animateP(); }
        void status(String s) { label = s == null || s.isEmpty() ? "" : s + "  (2× tap = stop)"; invalidate(); }
        void animateP() {
            ValueAnimator va = ValueAnimator.ofFloat(0, 1); va.setDuration(650);
            va.addUpdateListener(a -> { p = (float) a.getAnimatedValue(); invalidate(); });
            va.start();
        }
        @Override protected void onDraw(Canvas c) {
            if (p < 1 && x >= 0) {
                int alpha = (int) (255 * (1 - p));
                if (tr != null) { ring.setAlpha(alpha); c.drawLine(tr[0], tr[1], tr[2], tr[3], ring); }
                ring.setAlpha(alpha); dot.setAlpha((int) (170 * (1 - p)));
                c.drawCircle(x, y, 28 + 90 * p, ring);
                c.drawCircle(x, y, 26, dot);
            }
            if (!label.isEmpty()) {
                float w = txt.measureText("◉ AURA · " + label) + 48;
                float left = (getWidth() - w) / 2;
                c.drawRoundRect(left, 90, left + w, 160, 35, 35, pill);
                c.drawText("◉ AURA · " + label, left + 24, 137, txt);
            }
        }
    }
}
