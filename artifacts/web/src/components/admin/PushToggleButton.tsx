import { useState } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Bell, BellOff, BellRing, Loader2, X, Share, Home } from "lucide-react";

function IOSInstallGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-sm mx-auto bg-white rounded-t-2xl shadow-2xl p-5 pb-8 space-y-4">
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-full hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-500" />
        </button>

        {/* Title */}
        <div className="text-center pt-1">
          <div className="text-2xl mb-1">🔔</div>
          <h2 className="text-base font-bold text-gray-900">فعّل الإشعارات على iPhone</h2>
          <p className="text-xs text-gray-500 mt-1">
            على iPhone، لازم تضيف التطبيق للشاشة الرئيسية أولاً
          </p>
        </div>

        {/* Steps */}
        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center mt-0.5">١</span>
            <div>
              <p className="font-semibold text-gray-800">افتح Safari وادخل على الموقع</p>
              <p className="text-gray-500 text-xs">gab-school.com</p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center mt-0.5">٢</span>
            <div className="flex items-start gap-2">
              <div>
                <p className="font-semibold text-gray-800">اضغط زر المشاركة</p>
                <p className="text-gray-500 text-xs">الأيقونة السفلية في المنتصف</p>
              </div>
              <Share className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center mt-0.5">٣</span>
            <div className="flex items-start gap-2">
              <div>
                <p className="font-semibold text-gray-800">اختر «إضافة إلى الشاشة الرئيسية»</p>
                <p className="text-gray-500 text-xs">Add to Home Screen</p>
              </div>
              <Home className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center mt-0.5">٤</span>
            <div>
              <p className="font-semibold text-gray-800">افتح التطبيق من الشاشة الرئيسية</p>
              <p className="text-gray-500 text-xs">ثم فعّل الإشعارات من نفس الزر 🔔</p>
            </div>
          </li>
        </ol>

        {/* Note */}
        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 text-center">
          يعمل من iOS 16.4 فما فوق ✅
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-colors"
        >
          فهمت
        </button>
      </div>
    </div>
  );
}

export function PushToggleButton() {
  const { status, enable, disable } = usePushNotifications();
  const [showGuide, setShowGuide] = useState(false);

  if (status === "unsupported") return null;

  if (status === "loading") {
    return (
      <button disabled className="relative p-2 rounded-full text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </button>
    );
  }

  if (status === "ios-needs-pwa") {
    return (
      <>
        <button
          onClick={() => setShowGuide(true)}
          title="كيفية تفعيل الإشعارات على iPhone"
          className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-amber-600"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-400 ring-2 ring-card animate-pulse" />
        </button>
        {showGuide && <IOSInstallGuide onClose={() => setShowGuide(false)} />}
      </>
    );
  }

  if (status === "subscribed") {
    return (
      <button
        onClick={disable}
        title="إيقاف إشعارات الهاتف"
        className="relative p-2 rounded-full hover:bg-muted transition-colors text-green-600"
      >
        <BellRing className="w-5 h-5" />
      </button>
    );
  }

  if (status === "denied") {
    return (
      <button
        disabled
        title="تم رفض إذن الإشعارات — افتح إعدادات المتصفح لتفعيلها"
        className="relative p-2 rounded-full text-red-400 cursor-not-allowed"
      >
        <BellOff className="w-5 h-5" />
      </button>
    );
  }

  // unsubscribed
  return (
    <button
      onClick={enable}
      title="تفعيل إشعارات الهاتف (حتى والتطبيق مغلق)"
      className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-amber-600"
    >
      <Bell className="w-5 h-5" />
      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-card animate-pulse" />
    </button>
  );
}
