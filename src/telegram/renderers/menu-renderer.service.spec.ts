import { TelegramBotContext } from '../context/telegram-context';
import { buildKeyboard } from '../keyboards/home.keyboard';
import { TelegramMenuRenderer } from './menu-renderer.service';

function createCallbackContext() {
  const replyMock = jest.fn().mockResolvedValue(undefined);
  const editMessageTextMock = jest
    .fn()
    .mockRejectedValueOnce(new Error('message cannot be edited'));

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
});
