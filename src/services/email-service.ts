import nodemailer from 'nodemailer';

export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        // 配置邮件发送服务
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtpdm.aliyun.com',
            port: parseInt(process.env.SMTP_PORT || '25'),
            secure: (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) === 465 : false),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // 验证SMTP连接
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('SMTP connection error:', error);
            } else {
                console.log('SMTP server is ready to take our messages');
            }
        });
    }

    async sendVerificationEmail(to: string, verificationCode: string) {
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: to,
            subject: '邮箱验证码 - Deep Research',
            html: `
                <h1>欢迎注册 Deep Research</h1>
                <p>您的验证码是：<strong>${verificationCode}</strong></p>
                <p>验证码有效期为10分钟。</p>
                <p>如果这不是您的操作，请忽略此邮件。</p>
            `
        };

        try {
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Failed to send verification email:', error);
            return false;
        }
    }
}

// 创建验证码
export function generateVerificationCode(): string {
    return Math.random().toString().substr(2, 6);
}
