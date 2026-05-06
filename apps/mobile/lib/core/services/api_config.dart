import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants/app_constants.dart';

class ApiConfig {
  ApiConfig._();

  static const String _prefsKey = 'hh_api_base_url';

  static final ValueNotifier<String> baseUrlNotifier =
      ValueNotifier<String>(_normalizeOrDefault(AppConstants.apiBaseUrl));

  static String get baseUrl => baseUrlNotifier.value;
  static String get defaultBaseUrl =>
      _normalizeOrDefault(AppConstants.apiBaseUrl);

  static Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_prefsKey);
    final resolved = _normalizeOrDefault(stored);
    if (resolved != baseUrlNotifier.value) {
      baseUrlNotifier.value = resolved;
    }
  }

  static Future<void> setBaseUrl(String rawValue) async {
    final normalized = _normalizeOrDefault(rawValue);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, normalized);
    if (normalized != baseUrlNotifier.value) {
      baseUrlNotifier.value = normalized;
    }
  }

  static Future<void> resetToDefault() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsKey);
    if (baseUrlNotifier.value != defaultBaseUrl) {
      baseUrlNotifier.value = defaultBaseUrl;
    }
  }

  static bool isDefault(String value) {
    return _normalizeOrDefault(value) == defaultBaseUrl;
  }

  static String normalizeInput(String rawValue) {
    return _normalizeOrDefault(rawValue);
  }

  static String? tryNormalize(String rawValue) {
    var value = rawValue.trim();
    if (value.isEmpty) {
      return null;
    }

    if (!value.contains('://')) {
      value = '${_inferDefaultScheme(value)}://$value';
    }

    var uri = Uri.tryParse(value);
    if (uri == null || uri.host.isEmpty) {
      return null;
    }

    // Vercel serves HTTPS; using HTTP can return redirect (e.g. 308)
    // that some clients won't follow for POST requests.
    if (uri.scheme.toLowerCase() == 'http' && _isVercelHost(uri.host)) {
      uri = uri.replace(scheme: 'https');
    }

    final normalizedPath = uri.path == '/' ? '' : uri.path;
    final normalized = uri.replace(path: normalizedPath).toString();
    return normalized.endsWith('/')
        ? normalized.substring(0, normalized.length - 1)
        : normalized;
  }

  static String _inferDefaultScheme(String rawHostInput) {
    final host = rawHostInput.trim().toLowerCase();
    if (_isLikelyLocalHost(host)) {
      return 'http';
    }
    return 'https';
  }

  static bool _isVercelHost(String host) {
    return host.toLowerCase().endsWith('.vercel.app');
  }

  static bool _isLikelyLocalHost(String host) {
    final normalized = host.toLowerCase();
    if (normalized == 'localhost' ||
        normalized == '127.0.0.1' ||
        normalized == '10.0.2.2') {
      return true;
    }

    if (normalized.startsWith('192.168.') ||
        normalized.startsWith('127.') ||
        normalized.startsWith('10.')) {
      return true;
    }

    final match = RegExp(r'^172\.(\d{1,2})\.').firstMatch(normalized);
    if (match != null) {
      final secondOctet = int.tryParse(match.group(1) ?? '');
      if (secondOctet != null && secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }

    return false;
  }

  static String _normalizeOrDefault(String? rawValue) {
    final fallback = AppConstants.apiBaseUrl.trim();
    if (rawValue == null) {
      return fallback;
    }

    final normalized = tryNormalize(rawValue);
    if (normalized == null) {
      return fallback;
    }
    return normalized;
  }
}
