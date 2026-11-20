package com.mythbrix.cinetor.plugins;

import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/** Foreground service (type dataSync) that keeps downloads alive while the app is in the background. */
public class DownloadService extends Service {
    static final String PAUSE_ALL = "com.mythbrix.cinetor.PAUSE_ALL";
    static final String RESUME_ALL = "com.mythbrix.cinetor.RESUME_ALL";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Downloads d = Downloads.get(this);
        if (intent != null && PAUSE_ALL.equals(intent.getAction())) d.pauseAll(true);
        if (intent != null && RESUME_ALL.equals(intent.getAction())) d.pauseAll(false);
        if (Build.VERSION.SDK_INT >= 29) startForeground(Notify.ID, Notify.build(this, d), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(Notify.ID, Notify.build(this, d));
        if (d.totals()[0] == 0) stopSelf();
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
