'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    try {
      const activeThreadId = localStorage.getItem('active_agent_thread_id');
      if (activeThreadId && activeThreadId !== 'new') {
        router.replace(`/agents/${activeThreadId}`);
        return;
      }
    } catch (e) {}
    router.replace('/agents/new');
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center text-textColor/50">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Đang tải phiên làm việc NaN-Team AI...</span>
      </div>
    </div>
  );
}
