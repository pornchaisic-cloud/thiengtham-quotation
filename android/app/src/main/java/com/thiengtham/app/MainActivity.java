package com.thiengtham.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install the splash screen before calling super.onCreate()
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
