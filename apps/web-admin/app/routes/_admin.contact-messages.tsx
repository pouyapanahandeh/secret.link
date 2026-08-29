import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { requireAdminSession } from "~/lib/session.server";
import { adminApi } from "~/lib/api.server";
import { useLoaderData, useSearchParams, useNavigation } from "@remix-run/react";
import { ContactMessageCard, type ContactMessage } from "~/components/ContactMessageCard";
import { EmptyState } from "~/components/EmptyState";
import { FilterTabs } from "~/components/FilterTabs";
import { NavIcon } from "~/components/NavIcon";
import { PageHeader } from "~/components/PageHeader";

interface ContactInbox {
  messages: ContactMessage[];
  total: number;
  counts?: { new: number; read: number; archived: number };
  currentStatus: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "new";
  const data = await adminApi<Omit<ContactInbox, "currentStatus">>(`/contact-messages?status=${status}`, token);
  return { ...data, currentStatus: status };
}

export async function action({ request }: ActionFunctionArgs) {
  const { token } = await requireAdminSession(request);
  const formData = await request.formData();
  const messageId = formData.get("messageId") as string;
  const status = formData.get("status") as string;

  await adminApi(`/contact-messages/${messageId}`, token, {
    method: "PATCH",
    body: { status },
  });

  return { ok: true };
}

export default function ContactMessages() {
  const { messages, total, counts, currentStatus } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isActioning = navigation.state === "submitting";

  const tabs = [
    { id: "new", label: "New", count: counts?.new },
    { id: "read", label: "Read", count: counts?.read },
    { id: "archived", label: "Archived", count: counts?.archived },
  ];

  return (
    <div>
      <PageHeader title="Inbox" count={total} subtitle="Public contact form" />

      <FilterTabs
        tabs={tabs}
        activeId={currentStatus}
        onChange={(id) => setSearchParams({ status: id })}
      />

      {messages.length === 0 ? (
        <EmptyState
          icon={<NavIcon name="inbox" className="h-8 w-8" />}
          title={`No ${currentStatus} messages`}
          description="Contact form submissions from the public site appear here."
        />
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <ContactMessageCard key={msg.id} message={msg} isActioning={isActioning} />
          ))}
        </div>
      )}
    </div>
  );
}
