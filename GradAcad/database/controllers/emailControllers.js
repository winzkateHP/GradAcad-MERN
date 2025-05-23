import { createTransport } from 'nodemailer';
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import { getDB } from '../config/db.js';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const transporter = createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendApprovalEmail = async (req, res) => {
    const {to, username} = req.body;

    try {
        const info = await transporter.sendMail({
          from: `"GradAcad MIS" <${process.env.EMAIL_USER}>`, // Sender
          to, // Recipient's email
          subject: "GradAcad Registration Approved ✅",
          text: `Dear ${username},\n\nYour registration application for GradAcad has been approved! 🎉\n\nYou can now log in to your account and access the system.`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2>🎉 Registration Approved!</h2>
              <p>Dear <strong>${username}</strong>,</p>
              <p>We are pleased to inform you that your registration application for <strong>GradAcad</strong> has been approved.</p>
              <p>You can now log in to your account and start using the system.</p>
              <a href="https://nc-gradacad.vercel.app" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Log in Now
              </a>
              <p>If you have any questions, feel free to contact our support team.</p>
              <p>Best Regards,<br><strong>Norzagaray College - MIS Department</strong></p>
            </div>
          `,
        });

    

        if (info.messageId) {
            console.log("Approval email sent: ", info.messageId);
            return res.status(200).json({ success: true, message: "Approval email sent successfully!" });
        } else {
            return res.status(404).json({ success: false, message: "No data found for the given email or name" });
        }
        
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }

}

export const sendRejectionEmail = async (req, res) => {
    const {to, username} = req.body;

    try {
        const info = await transporter.sendMail({
          from: `"GradAcad MIS" <${process.env.EMAIL_USER}>`,
          to, // Recipient's email
          subject: "GradAcad Registration Rejected ❌",
          text: `Dear ${username},\n\nWe regret to inform you that your registration application for GradAcad has been rejected`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2>❌ Registration Rejected</h2>
              <p>Dear <strong>${username}</strong>,</p>
              <p>We regret to inform you that your registration application for <strong>GradAcad</strong> has been rejected.</p>
              <p>If you believe this was a mistake or have any questions, feel free to contact our support team.</p>
              <p>Best Regards,<br><strong>Norzagaray College - MIS Department</strong></p>
            </div>
          `,
        });

        if (info.messageId) {
            console.log("Rejection email sent: ", info.messageId);
            return res.status(200).json({ success: true, message: "Rejection email sent successfully!" });
        } else {
            return res.status(404).json({ success: false, message: "No data found for the given email or name" });
        }
      } catch (error) {
        console.error("Error sending rejection email: ", error);
        return { success: false, message: "Failed to send rejection email." };
      }
}

export const notifyEmailMissedSubjects = async (req, res) => {
  const { instructors } = req.body; // Expecting array of { to, username, subjectIds }

  if (!Array.isArray(instructors) || instructors.length === 0) {
    return res.status(400).json({ success: false, message: "Invalid instructors data" });
  }

  try {
    const results = [];

    for (const instructor of instructors) {
      const { to, username, subjectIds } = instructor;

      if (!to || !username || !Array.isArray(subjectIds)) {
        results.push({ to, success: false, error: "Missing required fields" });
        continue;
      }

      const subjectList = subjectIds.join(", ");

      const info = await transporter.sendMail({
        from: `"GradAcad MIS" <${process.env.EMAIL_USER}>`,
        to,
        subject: "⛔ Missed Subject Submission Notice",
        text: `Dear ${username},\n\nOur records indicate that you have missed submitting grades for the following subject(s):\n\n${subjectList}\n\nTo request for re-opening of these subjects, please coordinate with your College Dean and provide a formal letter addressed to the registrar.\n\nBest Regards,\nGradAcad - MIS`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>⛔ Missed Subject Submission Notice</h2>
            <p>Dear <strong>${username}</strong>,</p>
            <p>Our records indicate that you have <strong>missed submitting grades</strong> for the following subject(s):</p>
            <ul>
              ${subjectIds.map((id) => `<li>${id}</li>`).join("")}
            </ul>
            <p>To request for these subjects to be re-opened, please coordinate with your College Dean and submit a formal letter to the registrar.</p>
            <p>We appreciate your prompt attention to this matter.</p>
            <p>Best Regards,<br><strong>GradAcad - MIS</strong></p>
          </div>
        `,
      });

      results.push({
        to,
        success: true,
        messageId: info.messageId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Emails processed",
      results,
    });

  } catch (error) {
    console.error("Error sending batch emails:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const forgotPassword = async (req, res) => {
  const { emailOrId } = req.body;
  const db = getDB();

  try {
    const user = await db.collection("users").findOne({
      $or: [{ email: emailOrId }, { studentId: emailOrId }],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email or Student ID is not registered yet." });
    }

    // ✅ Generate a short-lived JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "15m" }
    );

    const resetLink = `https://nc-gradacad.vercel.app/reset_password?token=${token}`;

    // ✅ Send email with reset link
    const info = await transporter.sendMail({
      from: `"GradAcad MIS" <${process.env.EMAIL_USER}>`,
      to: user.email, // ✅ send to the found user's email
      subject: "Password Reset Request 🔐",
      text: `Dear ${user.name},\n\nYou requested to reset your password. Click the link below:\n\n${resetLink}\n\nThis link will expire in 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>🔐 Password Reset Request</h2>
          <p>Dear <strong>${user.name}</strong>,</p>
          <p>You requested to reset your password. Please click the link below to proceed:</p>
          <a href="${resetLink}" style="display: inline-block; background-color: #007BFF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
          <p>This link will expire in 15 minutes. If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br><strong>GradAcad MIS Department</strong></p>
        </div>
      `,
    });

    console.log("📧 Reset link sent:", info.messageId);
    return res.status(200).json({ success: true, message: "Reset link sent successfully." });

  } catch (error) {
    console.error("❌ Forgot password error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
