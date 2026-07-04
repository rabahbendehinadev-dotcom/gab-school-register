import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

export function PushToggleButton() {
  const { status, enable, disable } = usePushNotifications();

  if (status === "unsupported") return null;

  if (status === "loading") {
    return (
      <button disabled className="relative p-2 rounded-full text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </button>
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
