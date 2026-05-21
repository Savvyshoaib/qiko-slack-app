export const QIKO_LOGIN_MODAL_CALLBACK = "qiko_login_modal";
export const PASSWORD_TOGGLE_ACTION = "toggle_password_visibility";
export const PASSWORD_INPUT_ACTION = "password_input";

export type LoginModalOptions = {
  showPassword?: boolean;
  email?: string;
  passwordValue?: string;
};

export function buildLoginModal(options: LoginModalOptions = {}) {
  const showPassword = options.showPassword ?? false;
  const email = options.email ?? "";
  const passwordValue = options.passwordValue ?? "";
  const hasPassword = passwordValue.length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Use the same email and password as the Qiko web app. Your token is stored only on this Slack app server.",
      },
    },
    {
      type: "input",
      block_id: "email_block",
      label: { type: "plain_text", text: "Email" },
      element: {
        type: "plain_text_input",
        action_id: "email_input",
        placeholder: { type: "plain_text", text: "you@company.com" },
        ...(email ? { initial_value: email } : {}),
      },
    },
  ];

  if (showPassword) {
    blocks.push({
      type: "input",
      block_id: "password_block",
      label: { type: "plain_text", text: "Password" },
      hint: { type: "plain_text", text: " " },
      element: {
        type: "plain_text_input",
        action_id: PASSWORD_INPUT_ACTION,
        placeholder: { type: "plain_text", text: "Your Qiko password" },
        ...(passwordValue ? { initial_value: passwordValue } : {}),
        dispatch_action_config: {
          trigger_actions_on: ["on_character_entered"],
        },
      },
    });
    blocks.push({
      type: "actions",
      block_id: "password_toggle_block",
      elements: [
        {
          type: "button",
          action_id: PASSWORD_TOGGLE_ACTION,
          text: { type: "plain_text", text: "🙈 Hide password" },
          value: "hide",
        },
      ],
    });
  } else {
    const masked = hasPassword
      ? "•".repeat(Math.min(passwordValue.length, 24))
      : "_Hidden — click Show to enter_";
    blocks.push({
      type: "section",
      block_id: "password_block",
      text: {
        type: "mrkdwn",
        text: `*Password*\n${masked}`,
      },
      accessory: {
        type: "button",
        action_id: PASSWORD_TOGGLE_ACTION,
        text: { type: "plain_text", text: "👁 Show" },
        value: "show",
      },
    });
  }

  return {
    type: "modal" as const,
    callback_id: QIKO_LOGIN_MODAL_CALLBACK,
    title: { type: "plain_text" as const, text: "Qiko sign in" },
    submit: { type: "plain_text" as const, text: "Connect" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks,
  };
}
