export const QIKO_LOGIN_MODAL_CALLBACK = "qiko_login_modal";
export const PASSWORD_INPUT_ACTION = "password_input";
export const PASSWORD_TOGGLE_ACTION = "password_toggle";

type LoginModalOptions = {
  email?: string;
  passwordValue?: string;
  showPassword?: boolean;
  error?: string;
};

export function buildLoginModal(options: LoginModalOptions = {}) {
  const { email = "", passwordValue = "", showPassword = false, error } = options;

  const passwordBlocks = showPassword
    ? [
        {
          block_id: "password_block",
          type: "input",
          label: { type: "plain_text", text: "Password" },
          element: {
            type: "plain_text_input",
            action_id: PASSWORD_INPUT_ACTION,
            placeholder: { type: "plain_text", text: "Your Qiko password" },
            ...(passwordValue ? { initial_value: passwordValue } : {}),
          },
        },
        {
          type: "actions",
          block_id: "password_actions",
          elements: [
            {
              type: "button",
              action_id: PASSWORD_TOGGLE_ACTION,
              text: { type: "plain_text", text: "Hide password" },
              value: "hide",
            },
          ],
        },
      ]
    : [
        {
          type: "section",
          block_id: "password_masked",
          text: {
            type: "mrkdwn",
            text: passwordValue
              ? `*Password*\n${"•".repeat(Math.min(passwordValue.length, 12))}`
              : "*Password*\n_Enter password, then tap Show password_",
          },
        },
        {
          type: "actions",
          block_id: "password_actions",
          elements: [
            {
              type: "button",
              action_id: PASSWORD_TOGGLE_ACTION,
              text: { type: "plain_text", text: "Show password" },
              value: "show",
            },
          ],
        },
      ];

  return {
    type: "modal" as const,
    callback_id: QIKO_LOGIN_MODAL_CALLBACK,
    title: { type: "plain_text" as const, text: "Sign in" },
    submit: { type: "plain_text" as const, text: "Sign in" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      ...(error
        ? [
            {
              type: "section",
              block_id: "login_error",
              text: { type: "mrkdwn", text: `:warning: ${error}` },
            },
          ]
        : []),
      {
        block_id: "email_block",
        type: "input",
        label: { type: "plain_text", text: "Email" },
        element: {
          type: "plain_text_input",
          action_id: "email_input",
          placeholder: { type: "plain_text", text: "name@example.com" },
          ...(email ? { initial_value: email } : {}),
        },
      },
      ...passwordBlocks,
    ],
  };
}

/** Shown in-modal while the Qiko login API runs. */
export function buildLoginLoadingModal() {
  return {
    type: "modal" as const,
    callback_id: "qiko_login_loading",
    title: { type: "plain_text" as const, text: "Sign in" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":hourglass_flowing_sand: *Signing in…*\n\nConnecting to Qiko. Please wait.",
        },
      },
    ],
  };
}
