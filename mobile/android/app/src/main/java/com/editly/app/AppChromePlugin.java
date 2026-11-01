package com.editly.app;

import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tints the window behind the system bars. On WebViews older than 140, Capacitor pads the
 * WebView instead of drawing edge-to-edge, so this color is what shows behind the status and
 * navigation bars; matching it to the current screen keeps those strips seamless.
 */
@CapacitorPlugin(name = "AppChrome")
public class AppChromePlugin extends Plugin {

    @PluginMethod
    public void setBackground(PluginCall call) {
        String color = call.getString("color", "#0f172a");
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().getWindow().getDecorView().setBackgroundColor(Color.parseColor(color));
                call.resolve();
            } catch (IllegalArgumentException error) {
                call.reject("Invalid color: " + color);
            }
        });
    }
}
