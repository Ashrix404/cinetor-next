package com.mythbrix.cinetor.plugins;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/** Download notification: total %, Pause all / Resume all actions. */
final class Notify {
    static final String CH = "downloads";
    static final int ID = 4242;
    private static long last;

    static void askPermission(Activity a) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(a, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            ActivityCompat.requestPermissions(a, new String[] { Manifest.permission.POST_NOTIFICATIONS }, 77);
    }

    static void channel(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CH) == null)
                nm.createNotificationChannel(new NotificationChannel(CH, "Downloads", NotificationManager.IMPORTANCE_LOW));
        }
    }

    static android.app.Notification build(Context c, Downloads d) {
        channel(c);
        int[] t = d.totals();
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pause = PendingIntent.getService(c, 1, new Intent(c, DownloadService.class).setAction(DownloadService.PAUSE_ALL), flags);
        PendingIntent resume = PendingIntent.getService(c, 2, new Intent(c, DownloadService.class).setAction(DownloadService.RESUME_ALL), flags);
        Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CH)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(t[0] > 0 ? "Downloading " + t[0] + (t[0] == 1 ? " item" : " items") : "Downloads")
            .setContentText(t[1] + "%")
            .setProgress(100, t[1], false)
            .setOnlyAlertOnce(true)
            .setOngoing(t[0] > 0)
            .addAction(0, "Pause all", pause)
            .addAction(0, "Resume all", resume);
        if (launch != null) b.setContentIntent(PendingIntent.getActivity(c, 3, launch, flags));
        return b.build();
    }

    static void update(Context c, Downloads d) {
        long now = System.currentTimeMillis();
        if (now - last < 1000) return;
        last = now;
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        try {
            NotificationManagerCompat.from(c).notify(ID, build(c, d));
        } catch (SecurityException ignored) {
        }
    }
}
