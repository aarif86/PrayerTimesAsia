# kotlinx.serialization ships its own R8 rules; keep our @Serializable models' companions.
-keepclassmembers class com.prayertimesasia.core.** {
    *** Companion;
}
-keepclasseswithmembers class com.prayertimesasia.core.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.prayertimesasia.core.**$$serializer { *; }
