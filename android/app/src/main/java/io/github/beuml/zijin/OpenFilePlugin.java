package io.github.beuml.zijin;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * OpenFilePlugin（v0.7）：让子衿出现在微信/文件管理器的「用其他应用打开」里，
 * 并把文件内容交给 Web 层的导入管线。
 *
 * - VIEW：微信「用其他应用打开」/ 系统文件管理器 → intent.getData() 是文件 URI
 * - SEND：微信「分享到其他应用」→ EXTRA_STREAM 是文件 URI
 * - 冷启动：JS 启动时调 getInitialFile()；热启动：handleOnNewIntent 发 fileOpened 事件
 * - 文件一律读成 base64 交给 JS（成绩表量级 KB~几 MB，桥上无压力），不落缓存、不存盘
 */
@CapacitorPlugin(name = "OpenFile")
public class OpenFilePlugin extends Plugin {

    /** 25MB 上限：成绩表远用不到，超限多半是选错了文件 */
    private static final long MAX_BYTES = 25L * 1024 * 1024;

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        deliver(intent);
    }

    @PluginMethod
    public void getAppVersion(PluginCall call) {
        try {
            android.content.pm.PackageInfo pi = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("versionName", pi.versionName);
            ret.put("versionCode", pi.versionCode);
            call.resolve(ret);
        } catch (Exception e) {
            call.resolve();
        }
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void getInitialFile(PluginCall call) {
        Intent intent = bridge.getActivity().getIntent();
        JSObject file = readFile(intent);
        if (file == null) {
            // intent 确实是「打开文件」但读不出来 → 明确报错，不能静默无反应
            if (looksLikeFileOpen(intent)) {
                JSObject err = new JSObject();
                err.put("name", fileNameOf(intent));
                err.put("error", "文件读取失败——可能已被移动、删除或没有读取权限，请回到微信里重新发送或打开一次。");
                call.resolve(err);
                return;
            }
            call.resolve();
            return;
        }
        // 用过即弃：把 intent 清掉，防止下次从桌面普通启动又拿到这份旧文件
        bridge.getActivity().setIntent(new Intent());
        call.resolve(file);
    }

    private boolean looksLikeFileOpen(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        boolean fileAction = Intent.ACTION_VIEW.equals(action) || Intent.ACTION_SEND.equals(action);
        return fileAction && uriOf(intent) != null;
    }

    private void deliver(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_VIEW.equals(action) && !Intent.ACTION_SEND.equals(action)) return;
        JSObject file = readFile(intent);
        if (file == null) {
            JSObject err = new JSObject();
            err.put("message", "读不到这个文件——可能文件已被移动或删除，请在微信里重新打开。");
            notifyListeners("openFileError", err);
            return;
        }
        notifyListeners("fileOpened", file);
    }

    private Uri uriOf(Intent intent) {
        if (intent == null) return null;
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            return (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        return intent.getData();
    }

    private String fileNameOf(Intent intent) {
        Uri uri = uriOf(intent);
        if (uri == null) return null;
        String display = null;
        try {
            Cursor c = getContext().getContentResolver().query(uri, null, null, null, null);
            if (c != null) {
                try {
                    int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (idx >= 0 && c.moveToFirst()) display = c.getString(idx);
                } finally {
                    c.close();
                }
            }
        } catch (Exception ignored) {
            // 查不到名字就用路径段
        }
        if (display != null && !display.isEmpty()) return display;
        String last = uri.getLastPathSegment();
        return (last == null || last.isEmpty()) ? "成绩表" : last;
    }

    private JSObject readFile(Intent intent) {
        Uri uri = uriOf(intent);
        if (uri == null) return null;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            byte[] buf = new byte[8192];
            long total = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_BYTES) return null;
                out.write(buf, 0, n);
            }
        } catch (Exception e) {
            return null;
        }
        JSObject ret = new JSObject();
        ret.put("name", fileNameOf(intent));
        ret.put("base64", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
        return ret;
    }
}
