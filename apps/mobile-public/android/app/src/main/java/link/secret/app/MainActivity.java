package link.secret.app;

import android.os.Bundle;
import android.util.Log;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "SecretlinkPasskeys";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enablePasskeys();
    }

    /**
     * Android's embedded WebView exposes no WebAuthn API by default, so the
     * site's passkey login silently fails. This routes the ceremony to the
     * platform Credential Manager instead.
     *
     * The WebView will only hand over credentials for secretlink.life if that
     * domain's .well-known/assetlinks.json grants
     * delegate_permission/common.get_login_creds to this package and signing
     * certificate.
     */
    private void enablePasskeys() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            Log.w(TAG, "WebView too old for WebAuthn: passkey login will fail in the app");
            return;
        }
        WebSettingsCompat.setWebAuthenticationSupport(
            getBridge().getWebView().getSettings(),
            WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP
        );
        Log.i(TAG, "WebAuthn enabled for this WebView");
    }
}
