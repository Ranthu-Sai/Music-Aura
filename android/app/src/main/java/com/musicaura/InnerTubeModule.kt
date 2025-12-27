/* Native InnerTube implementation removed — JS fallback will be used. */


package com.musicaura

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.LifecycleEventListener

/**
 * Stubbed InnerTubeModule
 *
 * The full native InnerTube implementation depends on a third-party library
 * that isn't available in this project. This stub exports the same method
 * names but returns an explicit "NOT_IMPLEMENTED" rejection so that
 * JavaScript can fallback to the pure-JS InnerTube implementation.
 */
class InnerTubeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String {
        return "InnerTubeModule"
    }

    override fun onHostResume() {}
    override fun onHostPause() {}
    override fun onHostDestroy() {}

    private fun notImplemented(promise: Promise, feature: String) {
        promise.reject("NOT_IMPLEMENTED", "Native InnerTube is not available: $feature")
    }

    @ReactMethod
    fun search(query: String, filter: String?, promise: Promise) {
        notImplemented(promise, "search")
    }

    @ReactMethod
    fun getHome(promise: Promise) {
        notImplemented(promise, "getHome")
    }

    @ReactMethod
    fun getArtist(browseId: String, promise: Promise) {
        notImplemented(promise, "getArtist")
    }

    @ReactMethod
    fun getAlbum(browseId: String, promise: Promise) {
        notImplemented(promise, "getAlbum")
    }

    @ReactMethod
    fun getPlaylist(playlistId: String, promise: Promise) {
        notImplemented(promise, "getPlaylist")
    }

    @ReactMethod
    fun getNext(videoId: String, playlistId: String?, promise: Promise) {
        notImplemented(promise, "getNext")
    }
}
