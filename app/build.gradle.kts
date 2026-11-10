plugins {
    id("com.android.application")
}

android {
    namespace = "com.capypaint.capy"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.capypaint.capy"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        getByName("debug") {
            storeFile = file("${rootDir}/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

val buildWeb = tasks.register<Exec>("buildWeb") {
    description = "Compiles the web frontend bundle"
    workingDir = rootDir
    commandLine("npm", "run", "build")
}

val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
    dependsOn(buildWeb)
    from(file("${rootDir}/dist"))
    into(file("src/main/assets/www"))
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
