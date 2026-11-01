package com.inklyne.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppChromePlugin.class);
        super.onCreate(savedInstanceState);
        // The page layout is sized in CSS; Android's font-size setting would otherwise inflate PDF text.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
