export const QIKO_LOGIN_MODAL_CALLBACK = "qiko_login_modal";

export function buildLoginModal() {
  return {
    type: "modal" as const,
    callback_id: QIKO_LOGIN_MODAL_CALLBACK,
    title: { type: "plain_text" as const, text: "Qiko sign in" },
    submit: { type: "plain_text" as const, text: "Connect" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: "Use the same email and password as the Qiko web app. Your token is stored only on this Slack app server.",
        },
      },
      {
        type: "input" as const,
        block_id: "email_block",
        label: { type: "plain_text" as const, text: "Email" },
        element: {
          type: "plain_text_input" as const,
          action_id: "email_input",
          placeholder: { type: "plain_text" as const, text: "you@company.com" },
        },
      },
      {
        type: "input" as const,
        block_id: "password_block",
        label: { type: "plain_text" as const, text: "Password" },
        element: {
          type: "plain_text_input" as const,
          action_id: "password_input",
          placeholder: { type: "plain_text" as const, text: "Your Qiko password" },
        },
      },
    ],
  };
}
