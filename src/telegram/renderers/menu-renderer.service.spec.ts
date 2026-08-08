import { TelegramBotContext } from '../context/telegram-context';
import { buildKeyboard } from '../keyboards/home.keyboard';
import { TelegramMenuRenderer } from './menu-renderer.service';

function createCallbackContext() {
  const replyMock = jest.fn().mockResolvedValue(undefined);
  const editMessageTextMock = jest.fn();

  const context = {
    update: { callback_query: { id: 'callback-id' } },
    reply: replyMock,
    editMessageText: editMessageTextMock,
  } as unknown as TelegramBotContext;

  return {
    context,
    replyMock,
    editMessageTextMock,
  };
}

describe('TelegramMenuRenderer', () => {
  it('falls back to reply when editMessageText fails', async () => {
    const renderer = new TelegramMenuRenderer();
    const { context, replyMock, editMessageTextMock } = createCallbackContext();
    editMessageTextMock.mockRejectedValueOnce(
      new Error('message cannot be edited'),
    );

    await renderer.renderScreen(context, {
      text: 'fallback message',
      keyboard: buildKeyboard([]),
    });

    expect(editMessageTextMock).toHaveBeenCalled();
    expect(replyMock).toHaveBeenCalledWith(
      'fallback message',
      expect.objectContaining({
        parse_mode: 'HTML',
      }),
    );
  });

  it('does not send a duplicate reply when Telegram reports an unchanged message', async () => {
    const renderer = new TelegramMenuRenderer();
    const { context, replyMock, editMessageTextMock } = createCallbackContext();
    editMessageTextMock.mockRejectedValueOnce(
      new Error('400: Bad Request: message is not modified'),
    );

    await renderer.renderScreen(context, {
      text: 'same message',
      keyboard: buildKeyboard([]),
    });

    expect(editMessageTextMock).toHaveBeenCalled();
    expect(replyMock).not.toHaveBeenCalled();
  });
});
