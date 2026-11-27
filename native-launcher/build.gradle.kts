plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.balnc.audioddesk"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.balnc.audioddesk.nativepreview"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "5.0.0-native-preview.1"
    }
    signingConfigs {
        create("stableDebug") {
            storeFile = rootProject.file("app/audio-desk-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }
    buildTypes { debug { signingConfig = signingConfigs.getByName("stableDebug") } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all { it.systemProperty("robolectric.dependency.repo.url", "https://repo.maven.apache.org/maven2") }
        }
    }
}
dependencies {
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.14.1")
}
