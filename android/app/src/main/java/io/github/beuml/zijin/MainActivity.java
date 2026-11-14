package io.github.beuml.zijin;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 本地插件必须在 super.onCreate 之前注册（bridge 在 super 里完成装载）
        registerPlugin(OpenFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
