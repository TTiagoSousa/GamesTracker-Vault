package me.homesousa.gametracker;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Run by Android every half hour or so (with network): fetches new price alerts. */
public class AlertsJob extends JobService {

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            Alerts.fetch(getApplicationContext());
            jobFinished(params, false);
        }).start();
        // Still working (on the thread)
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        // Android stopped it early: the next run tries again
        return false;
    }
}
