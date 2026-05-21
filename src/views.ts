/** Slack modal opens the web sign-in page (real password field + eye toggle). */

export function buildLoginModal(loginUrl: string) {
  return {
    type: "modal" as const,
    callback_id: "qiko_login_link_modal",
    title: { type: "plain_text" as const, text: "Qiko sign in" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Use the secure sign-in page (password hidden by default, eye icon to show).",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Sign in" },
            url: loginUrl,
            action_id: "open_qiko_login",
          },
        ],
      },
    ],
  };
}
