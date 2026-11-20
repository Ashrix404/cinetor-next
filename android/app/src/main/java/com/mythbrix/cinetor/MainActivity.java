package com.mythbrix.cinetor;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(com.mythbrix.cinetor.plugins.CinetorNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
