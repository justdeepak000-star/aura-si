package com.jarvis.voiceassistant;

import android.Manifest;
import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.AlarmClock;
import android.provider.ContactsContract;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;
import java.util.List;

@CapacitorPlugin(name = "Jarvis", permissions = {
    @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS }),
    @Permission(alias = "phone", strings = { Manifest.permission.CALL_PHONE })
})
public class JarvisPlugin extends Plugin {

    private boolean ensure(String perm) {
        if (ContextCompat.checkSelfPermission(getContext(), perm) == PackageManager.PERMISSION_GRANTED) return true;
        ActivityCompat.requestPermissions(getActivity(), new String[]{perm}, 4711);
        return false;
    }

    private void start(Intent i) { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getActivity().startActivity(i); }

    @PluginMethod
    public void setAlarm(PluginCall call) {
        Intent i = new Intent(AlarmClock.ACTION_SET_ALARM);
        i.putExtra(AlarmClock.EXTRA_HOUR, call.getInt("hour", 0));
        i.putExtra(AlarmClock.EXTRA_MINUTES, call.getInt("minute", 0));
        i.putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("label", "AURA"));
        i.putExtra(AlarmClock.EXTRA_SKIP_UI, true);
        try { start(i); call.resolve(); }
        catch (Exception e) { call.reject("No clock app: " + e.getMessage()); }
    }

    /** Every launchable app on the phone: [{name, package}]. */
    @PluginMethod
    public void listApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN); main.addCategory(Intent.CATEGORY_LAUNCHER);
        com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
        java.util.HashSet<String> seen = new java.util.HashSet<>();
        for (android.content.pm.ResolveInfo ri : pm.queryIntentActivities(main, 0)) {
            String pkg = ri.activityInfo.packageName;
            if (!seen.add(pkg)) continue;
            JSObject o = new JSObject();
            o.put("name", String.valueOf(ri.loadLabel(pm)));
            o.put("package", pkg);
            arr.put(o);
        }
        JSObject r = new JSObject(); r.put("apps", arr); call.resolve(r);
    }

    private static String norm(String s) { return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9\\u0C00-\\u0C7F]", ""); }

    @PluginMethod
    public void openAppByName(PluginCall call) {
        String raw = call.getString("name", "");
        String name = norm(raw);
        String want = call.getString("package", "");
        String url = call.getString("url", "");
        PackageManager pm = getContext().getPackageManager();
        if (want != null && !want.isEmpty()) {
            Intent l = pm.getLaunchIntentForPackage(want);
            if (l != null) { start(l); JSObject r = new JSObject(); r.put("opened", "app"); call.resolve(r); return; }
        }
        Intent main = new Intent(Intent.ACTION_MAIN); main.addCategory(Intent.CATEGORY_LAUNCHER);
        String best = null; int score = 0;
        for (android.content.pm.ResolveInfo ri : pm.queryIntentActivities(main, 0)) {
            String label = norm(String.valueOf(ri.loadLabel(pm)));
            String pkg = ri.activityInfo.packageName.toLowerCase();
            int sc = label.equals(name) ? 100 : (!name.isEmpty() && label.startsWith(name)) ? 80
                : (!name.isEmpty() && label.contains(name)) ? 60 : (!name.isEmpty() && pkg.contains(name)) ? 50
                : (!label.isEmpty() && name.contains(label) && label.length() > 2) ? 40 : 0;
            if (sc > score) { score = sc; best = ri.activityInfo.packageName; }
        }
        if (best != null) {
            Intent launch = pm.getLaunchIntentForPackage(best);
            if (launch != null) { start(launch); JSObject r = new JSObject(); r.put("opened", "app"); r.put("package", best); call.resolve(r); return; }
        }
        if (url == null || url.isEmpty()) url = "https://www.google.com/search?q=" + Uri.encode(raw);
        start(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        JSObject r = new JSObject(); r.put("opened", "web"); call.resolve(r);
    }

    @PluginMethod
    public void findContact(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) { requestPermissionForAlias("contacts", call, "contactsCb"); return; }
        doFind(call);
    }

    @PermissionCallback
    private void contactsCb(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) doFind(call);
        else call.reject("Allow Contacts permission for AURA");
    }

    private void doFind(PluginCall call) {
        String name = call.getString("name", "").trim();
        try (Cursor c = getContext().getContentResolver().query(
                Uri.withAppendedPath(ContactsContract.CommonDataKinds.Phone.CONTENT_FILTER_URI, Uri.encode(name)),
                new String[]{ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER},
                null, null, null)) {
            if (c != null && c.moveToFirst()) {
                JSObject r = new JSObject(); r.put("name", c.getString(0)); r.put("number", c.getString(1));
                call.resolve(r); return;
            }
        } catch (Exception e) { call.reject(e.getMessage()); return; }
        call.reject("Contact not found");
    }

    @PluginMethod
    public void makeCall(PluginCall call) {
        if (getPermissionState("phone") != PermissionState.GRANTED) { requestPermissionForAlias("phone", call, "phoneCb"); return; }
        doCall(call);
    }

    @PermissionCallback
    private void phoneCb(PluginCall call) { doCall(call); }

    private void doCall(PluginCall call) {
        boolean ok = getPermissionState("phone") == PermissionState.GRANTED;
        start(new Intent(ok ? Intent.ACTION_CALL : Intent.ACTION_DIAL, Uri.parse("tel:" + call.getString("number", ""))));
        call.resolve();
    }

    /** Open a URL inside a specific app (YouTube, Maps, Spotify...) with web fallback. */
    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url", "");
        String pkg = call.getString("package", "");
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        if (pkg != null && !pkg.isEmpty()) i.setPackage(pkg);
        try { start(i); } catch (Exception e) { i.setPackage(null); start(i); }
        call.resolve();
    }

    /** System controls: settings, home, notifications, back, recents, camera, etc. */
    @PluginMethod
    public void systemAction(PluginCall call) {
        String a = call.getString("action", "");
        AuraAccessibilityService s = AuraAccessibilityService.instance;
        try {
            switch (a) {
                case "settings": start(new Intent(Settings.ACTION_SETTINGS)); break;
                case "wifi": start(new Intent(Settings.ACTION_WIFI_SETTINGS)); break;
                case "bluetooth": start(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)); break;
                case "camera": start(new Intent(android.provider.MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)); break;
                case "home": {
                    if (s != null && s.global(AccessibilityService.GLOBAL_ACTION_HOME)) break;
                    Intent h = new Intent(Intent.ACTION_MAIN); h.addCategory(Intent.CATEGORY_HOME); start(h); break;
                }
                case "notifications":
                    if (s == null || !s.global(AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS)) { call.reject("Turn on AURA Operator in Accessibility"); return; }
                    break;
                case "quick_settings":
                    if (s == null || !s.global(AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS)) { call.reject("Turn on AURA Operator in Accessibility"); return; }
                    break;
                case "back":
                    if (s == null || !s.global(AccessibilityService.GLOBAL_ACTION_BACK)) { call.reject("Turn on AURA Operator in Accessibility"); return; }
                    break;
                case "recents":
                    if (s == null || !s.global(AccessibilityService.GLOBAL_ACTION_RECENTS)) { call.reject("Turn on AURA Operator in Accessibility"); return; }
                    break;
                default: call.reject("Unknown system action " + a); return;
            }
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void sendWhatsApp(PluginCall call) {
        String n = call.getString("number", "").replaceAll("[^0-9]", "");
        if (n.length() == 10) n = "91" + n;
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/" + n + "?text=" + Uri.encode(call.getString("message", ""))));
        i.setPackage("com.whatsapp");
        try { start(i); } catch (Exception e) { i.setPackage(null); start(i); }
        autoSend(call);
    }

    /** Voice note: writes base64 audio to cache and shares it straight into a WhatsApp chat. */
    @PluginMethod
    public void sendVoiceNote(PluginCall call) {
        try {
            byte[] data = android.util.Base64.decode(call.getString("base64", ""), android.util.Base64.DEFAULT);
            java.io.File f = new java.io.File(getContext().getCacheDir(), "aura_voice_" + System.currentTimeMillis() + ".mp3");
            try (java.io.FileOutputStream o = new java.io.FileOutputStream(f)) { o.write(data); }
            Uri u = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            String n = call.getString("number", "").replaceAll("[^0-9]", "");
            if (n.length() == 10) n = "91" + n;
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("audio/mpeg");
            i.putExtra(Intent.EXTRA_STREAM, u);
            if (!n.isEmpty()) i.putExtra("jid", n + "@s.whatsapp.net");
            i.setPackage("com.whatsapp");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            start(i);
            autoSend(call);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    /** Press Send via the operator service, then return to AURA. */
    private void autoSend(PluginCall call) {
        AuraAccessibilityService s = AuraAccessibilityService.instance;
        if (s != null) s.autoSendAndReturn();
        JSObject r = new JSObject(); r.put("autoSent", s != null); call.resolve(r);
    }

    @PluginMethod
    public void sendSMS(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + call.getString("number", "")));
        i.putExtra("sms_body", call.getString("message", ""));
        start(i);
        autoSend(call);
    }

    @PluginMethod
    public void sendEmail(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:"));
        i.putExtra(Intent.EXTRA_EMAIL, new String[]{ call.getString("to", "") });
        i.putExtra(Intent.EXTRA_SUBJECT, call.getString("subject", ""));
        i.putExtra(Intent.EXTRA_TEXT, call.getString("body", ""));
        i.setPackage("com.google.android.gm");
        try { start(i); } catch (Exception e) { i.setPackage(null); start(i); }
        autoSend(call);
    }

    // ───────── GUI Operator bridge ─────────
    @PluginMethod
    public void checkAccessibilityService(PluginCall call) {
        JSObject r = new JSObject(); r.put("enabled", AuraAccessibilityService.instance != null); call.resolve(r);
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        start(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)); call.resolve();
    }

    private AuraAccessibilityService svc(PluginCall call) {
        AuraAccessibilityService s = AuraAccessibilityService.instance;
        if (s == null) call.reject("Turn on AURA Operator in Accessibility settings");
        return s;
    }

    @PluginMethod
    public void readScreen(PluginCall call) {
        AuraAccessibilityService s = svc(call); if (s == null) return;
        try { call.resolve(JSObject.fromJSONObject(s.readScreen())); }
        catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void operatorStatus(PluginCall call) {
        AuraAccessibilityService s = AuraAccessibilityService.instance;
        if (s != null) s.setStatus(call.getString("text", ""));
        call.resolve();
    }

    @PluginMethod
    public void gesture(PluginCall call) {
        AuraAccessibilityService s = svc(call); if (s == null) return;
        String a = call.getString("action", "");
        boolean ok;
        switch (a) {
            case "tap_node": ok = s.tapNode(call.getInt("index", -1)); break;
            case "tap": ok = s.tap(call.getFloat("x", 0f), call.getFloat("y", 0f)); break;
            case "long_press": ok = s.longPress(call.getFloat("x", 0f), call.getFloat("y", 0f)); break;
            case "swipe": ok = s.swipe(call.getFloat("x1", 0f), call.getFloat("y1", 0f), call.getFloat("x2", 0f), call.getFloat("y2", 0f), 350); break;
            case "scroll": ok = s.scroll(call.getString("direction", "down")); break;
            case "type": ok = s.typeText(call.getInt("index", -1), call.getString("text", "")); break;
            case "enter": ok = s.submitIme(); break;
            case "click_text": ok = s.clickText(call.getString("text", "")); break;
            case "back": ok = s.global(AccessibilityService.GLOBAL_ACTION_BACK); break;
            case "home": ok = s.global(AccessibilityService.GLOBAL_ACTION_HOME); break;
            case "recents": ok = s.global(AccessibilityService.GLOBAL_ACTION_RECENTS); break;
            case "notifications": ok = s.global(AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS); break;
            default: call.reject("Unknown gesture " + a); return;
        }
        JSObject r = new JSObject(); r.put("ok", ok); call.resolve(r);
    }

    /** Legacy simple automation used by voice commands. */
    @PluginMethod
    public void automateUI(PluginCall call) {
        AuraAccessibilityService s = svc(call); if (s == null) return;
        String a = call.getString("action", "");
        boolean ok;
        if ("scroll".equals(a)) ok = s.scroll(call.getString("direction", "down"));
        else if ("click".equals(a)) ok = s.clickText(call.getString("text", ""));
        else if ("back".equals(a)) ok = s.global(AccessibilityService.GLOBAL_ACTION_BACK);
        else ok = s.global(AccessibilityService.GLOBAL_ACTION_HOME);
        if (ok) call.resolve(); else call.reject("Could not do that on this screen");
    }
}
