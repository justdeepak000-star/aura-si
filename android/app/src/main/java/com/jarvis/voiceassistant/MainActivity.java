package com.jarvis.voiceassistant;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JarvisPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
