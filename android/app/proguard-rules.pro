# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native specific rules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.flipper.** { *; }

# Keep Hermes classes
-keep class com.facebook.hermes.** { *; }

# Keep Firebase classes
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Optimize for size
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose

# Remove logging
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# Suppress warnings for missing classes
-dontwarn com.facebook.common.internal.VisibleForTesting
-dontwarn java.beans.BeanDescriptor
-dontwarn java.beans.BeanInfo
-dontwarn java.beans.IntrospectionException
-dontwarn java.beans.Introspector
-dontwarn java.beans.PropertyDescriptor
-dontwarn javax.script.ScriptEngineFactory
-dontwarn com.google.re2j.Matcher
-dontwarn com.google.re2j.Pattern

# Keep jsoup classes
-keep class org.jsoup.** { *; }
-keepattributes *Annotation*
-dontwarn org.jsoup.**

# Keep Fresco classes (image pipeline)
-keep class com.facebook.imagepipeline.** { *; }
-dontwarn com.facebook.imagepipeline.**
-keep,allowobfuscation interface com.facebook.imagepipeline.image.CloseableImage
-keep class com.facebook.imagepipeline.image.CloseableAnimatedImage { *; }

# R8 warning suppression: CloseableAnimatedImage extends CloseableImage (interface)
# This is a known harmless warning from some Fresco builds; add targeted dontwarn rules
-dontwarn com.facebook.imagepipeline.image.CloseableAnimatedImage
-dontwarn com.facebook.imagepipeline.image.CloseableImage
