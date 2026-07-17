import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { ErrorNote } from './login-ui'
import { inputClass, primaryBtn, quietLink } from './login-ui'
import { OtpField } from './code-input'
import { type Channel, CODE_ERRORS, CHANNEL_SUBS } from './operator-login'

interface OperatorTwoFactorProps {
  backToCredentials: () => void
  switchChannel: (channel: Channel) => void
  verify: (e: React.FormEvent<HTMLFormElement>) => void
  channel: Channel
  code: string  
  codeError: boolean
  setChannel: (channel: Channel) => void
  setCode: (code: string) => void
}

const OperatorTwoFactor = ({backToCredentials, switchChannel, verify, channel, code, codeError, setChannel, setCode}: OperatorTwoFactorProps) => {
  return (
      <>
          <button
              type='button'
              onClick={backToCredentials}
              className='mb-3.5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-it-text-muted transition-colors hover:text-it-ink'>
              <ArrowLeft className='size-3.5' strokeWidth={1.5} />
              Back
          </button>
          <h1 className='m-0 font-it-display text-[23px] font-semibold text-it-heading'>
              Enter your code
          </h1>
          <p className='mb-4 mt-1.5 text-[14px] text-it-text-muted'>
              {CHANNEL_SUBS[channel]}
          </p>

          {codeError && <ErrorNote>{CODE_ERRORS[channel]}</ErrorNote>}

          <form onSubmit={verify} noValidate>
              <div className='mb-3 text-center text-[13px] font-semibold text-it-heading'>
                  {channel === 'backup' ? 'Backup code' : '6-digit code'}
              </div>
              {channel === 'backup' ? (
                  <input
                      id='o-code'
                      type='text'
                      name='code'
                      autoComplete='one-time-code'
                      autoCapitalize='characters'
                      spellCheck={false}
                      maxLength={14}
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase())}
                      placeholder='Enter a backup code'
                      className={`${inputClass} text-center tracking-[0.15em] placeholder:tracking-normal placeholder:normal-case`}
                  />
              ) : (
                  <OtpField value={code} onChange={setCode} />
              )}
              <label className='my-4 flex items-center justify-center gap-2.25 text-[13.5px] text-it-text-muted'>
                  <input type='checkbox' className='size-4 accent-it-primary' />
                  Remember this device for 30 days
              </label>
              <button type='submit' className={primaryBtn}>
                  Verify
              </button>
          </form>

          <div className='mt-4 flex flex-col items-center gap-2.25'>
              <button
                  type='button'
                  onClick={() => switchChannel('wa')}
                  className={quietLink}>
                  Send the code to WhatsApp instead
              </button>
              <button
                  type='button'
                  onClick={() => switchChannel('backup')}
                  className={quietLink}>
                  Use a backup code
              </button>
          </div>
      </>
  );
}


export default OperatorTwoFactor