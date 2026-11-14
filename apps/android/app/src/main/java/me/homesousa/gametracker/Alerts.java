package me.homesousa.gametracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.NumberFormat;
import java.util.Currency;

/**
 * Price alerts as phone notifications.
 *
 * When the user turns them on (Prices page), the server gives the app a read-only token.
 * Every half hour or so Android runs {@link AlertsJob}, which asks the server for the
 * notifications after the last one seen (GET /notifications?after=) and shows each as a
 * notification. Tapping one opens the game's page in the app. A revoked token (401)
 * turns the alerts off.
 */
final class Alerts {

    private static final String PREFS = "gametracker_alerts";
    private static final String KEY_API = "api";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_TOKEN_ID = "token_id";
    private static final String KEY_AFTER = "after";

    private static final String CHANNEL = "price_alerts";
    private static final int JOB_ID = 4201;
    // Android runs periodic jobs at most every 15 minutes, and when it suits the battery
    private static final long EVERY_MS = 30 * 60 * 1000L;

    /** Extra of the Activity's Intent: the site path to open ("/Vault/Game/123"). */
    static final String EXTRA_PATH = "open_path";

    private Alerts() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean enabled(Context context) {
        return prefs(context).getString(KEY_TOKEN, null) != null;
    }

    static void enable(Context context, String api, String token, String tokenId, long after) {
        prefs(context).edit()
                .putString(KEY_API, api)
                .putString(KEY_TOKEN, token)
                .putString(KEY_TOKEN_ID, tokenId)
                .putLong(KEY_AFTER, after)
                .apply();
        createChannel(context);
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null) return;
        scheduler.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(context, AlertsJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(EVERY_MS)
                .setPersisted(true)
                .build());
    }

    static void disable(Context context) {
        prefs(context).edit().clear().apply();
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler != null) scheduler.cancel(JOB_ID);
    }

    /** Whether Android lets the app show notifications (Android 13+ asks the user). */
    static boolean allowed(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        return manager != null && manager.areNotificationsEnabled();
    }

    /** { enabled, tokenId, allowed } for the page. */
    static String status(Context context) {
        try {
            JSONObject json = new JSONObject();
            json.put("enabled", enabled(context));
            String tokenId = prefs(context).getString(KEY_TOKEN_ID, null);
            json.put("tokenId", tokenId != null ? tokenId : JSONObject.NULL);
            json.put("allowed", allowed(context));
            return json.toString();
        } catch (Exception e) {
            return "{\"enabled\":false,\"tokenId\":null,\"allowed\":false}";
        }
    }

    private static void createChannel(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL, context.getString(R.string.alerts_channel), NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription(context.getString(R.string.alerts_channel_description));
        manager.createNotificationChannel(channel);
    }

    /** Asks the server for new alerts and shows them. Runs off the main thread. */
    static void fetch(Context context) {
        SharedPreferences prefs = prefs(context);
        String api = prefs.getString(KEY_API, null);
        String token = prefs.getString(KEY_TOKEN, null);
        if (api == null || token == null) return;
        long after = prefs.getLong(KEY_AFTER, 0);

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(api + "/notifications?limit=20&after=" + after).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(15000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            int status = connection.getResponseCode();
            if (status == 401) {
                // The token was revoked (Settings → API) or the account deleted
                disable(context);
                return;
            }
            if (status != 200) return;

            StringBuilder body = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"))) {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            }
            JSONArray items = new JSONObject(body.toString()).optJSONArray("items");
            if (items == null) return;

            createChannel(context);
            long newest = after;
            // Newest first in the answer: shown oldest first
            for (int i = items.length() - 1; i >= 0; i--) {
                JSONObject item = items.getJSONObject(i);
                long id = item.optLong("id");
                if (id <= after) continue;
                show(context, item);
                newest = Math.max(newest, id);
            }
            if (newest > after) prefs.edit().putLong(KEY_AFTER, newest).apply();
        } catch (Exception ignored) {
            // No network or server: the next run tries again
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String money(double value, String currency) {
        try {
            NumberFormat format = NumberFormat.getCurrencyInstance();
            format.setCurrency(Currency.getInstance(currency));
            return format.format(value);
        } catch (Exception e) {
            return String.format(java.util.Locale.ROOT, "%.2f %s", value, currency);
        }
    }

    private static void show(Context context, JSONObject item) {
        if (!"PRICE_DROP".equals(item.optString("kind"))) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || !manager.areNotificationsEnabled()) return;

        String price = money(item.optDouble("price"), item.optString("currency", "USD"));
        String shop = item.isNull("shop") ? null : item.optString("shop");
        String text = shop != null
                ? context.getString(R.string.alert_drop, price, shop)
                : context.getString(R.string.alert_drop_no_shop, price);
        int cut = item.optInt("cut", 0);
        StringBuilder detail = new StringBuilder(text);
        if (cut > 0) detail.append(" · ").append(context.getString(R.string.alert_cut, cut));
        if (item.optBoolean("isLowest")) detail.append(" · ").append(context.getString(R.string.alert_lowest));

        int id = (int) item.optLong("id");
        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (!item.isNull("gameId")) {
            open.putExtra(EXTRA_PATH, "/Vault/Game/" + item.optLong("gameId"));
        } else {
            open.putExtra(EXTRA_PATH, "/Vault/Prices");
        }
        // A distinct data URI keeps each notification's extras apart
        open.setData(Uri.parse("gametracker://alert/" + id));
        PendingIntent tap = PendingIntent.getActivity(context, id, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(item.optString("gameName"))
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(detail.toString()))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setColor(0xFFFF8A1F)
                .setCategory(Notification.CATEGORY_RECOMMENDATION)
                .build();
        manager.notify(CHANNEL, id, notification);
    }

    /** Only paths inside the site, so a notification can't send the app elsewhere. */
    static String safePath(String path) {
        if (path == null || !path.startsWith("/Vault/") || path.contains("//") || path.contains("..")) return null;
        return path;
    }

    static boolean newerThanTiramisu() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU;
    }
}
