package com.orbit

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Minimal stub module until native InnerTube/YouTube implementations are added.
class InnerTubeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "InnerTubeModule"
    }

    @ReactMethod
    fun search(query: String, filter: String?, promise: Promise) {
        promise.reject("NOT_IMPLEMENTED", "Native InnerTube not available")
    }

    @ReactMethod
    fun getHome(promise: Promise) {
        promise.reject("NOT_IMPLEMENTED", "Native InnerTube not available")
    }

    @ReactMethod
    fun getNext(videoId: String, playlistId: String?, promise: Promise) {
        promise.reject("NOT_IMPLEMENTED", "Native InnerTube not available")
    }
}
