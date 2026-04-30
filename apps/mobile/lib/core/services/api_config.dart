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
      value = 'http://$value';
    }

    final uri = Uri.tryParse(value);
    if (uri == null || uri.host.isEmpty) {
      return null;
    }

    final normalizedPath = uri.path == '/' ? '' : uri.path;
    final normalized = uri.replace(path: normalizedPath).toString();
    return normalized.endsWith('/')
        ? normalized.substring(0, normalized.length - 1)
        : normalized;
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
