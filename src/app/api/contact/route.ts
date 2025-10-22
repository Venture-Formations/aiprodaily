import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase'
import nodemailer from 'nodemailer'

const resend = new Resend(process.env.RESEND_API_KEY)

// Gmail SMTP transporter (temporary solution while waiting for DNS)
const gmailTransporter = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, message } = body

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Get contact email from business settings
    const { data: contactEmailSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'contact_email')
      .single()

    const contactEmail = contactEmailSetting?.value || 'noreply@aiaccountingdaily.com'

    // Store submission in database
    const { error: dbError } = await supabaseAdmin
      .from('contact_submissions')
      .insert([{
        name,
        email,
        message,
        newsletter_id: 'accounting',
        status: 'new'
      }])

    if (dbError) {
      console.error('[CONTACT] Failed to store submission:', dbError)
      throw new Error('Failed to store submission')
    }

    // Send email notification
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1c293d;">New Contact Form Submission</h2>

          <div style="background-color: #f5f5f7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
          </div>

          <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <p style="margin: 0 0 10px 0;"><strong>Message:</strong></p>
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>

          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This email was sent from the AI Accounting Daily contact form.
          </p>
        </div>
      `

      // Use Gmail SMTP if configured (temporary solution), otherwise use Resend
      if (gmailTransporter) {
        console.log('[CONTACT] Using Gmail SMTP to send notification')
        await gmailTransporter.sendMail({
          from: `"AI Accounting Daily" <${process.env.GMAIL_USER}>`,
          to: contactEmail,
          subject: 'Contact Form - AI Accounting Daily',
          html: emailHtml,
          replyTo: email // Allow replying directly to the submitter
        })
      } else {
        console.log('[CONTACT] Using Resend to send notification')
        await resend.emails.send({
          from: 'AI Accounting Daily <noreply@aiaccountingdaily.com>',
          to: contactEmail,
          subject: 'Contact Form - AI Accounting Daily',
          html: emailHtml
        })
      }
    } catch (emailError: any) {
      console.error('[CONTACT] Failed to send email:', emailError)
      // Don't fail the request if email fails - submission is already stored
      // Return success but note the email issue
      return NextResponse.json({
        success: true,
        message: 'Your message was received, but there was an issue sending the notification email. We will still respond to your submission.',
        warning: 'email_failed'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully!'
    })

  } catch (error: any) {
    console.error('[CONTACT] Error processing submission:', error)
    return NextResponse.json(
      {
        error: 'Failed to process your submission. Please try again later.',
        details: error.message
      },
      { status: 500 }
    )
  }
}
