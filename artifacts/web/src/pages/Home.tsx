import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/gab-c7x2p/login"); }, [setLocation]);
  return null;
}
