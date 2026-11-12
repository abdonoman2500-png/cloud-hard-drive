# تشغيل Cloud Hard Drive

## متطلبات النشر

- Docker Engine و Docker Compose plugin.
- اسم نطاق مع HTTPS للإنتاج (مثلاً عبر Nginx/Caddy أو منصة استضافة تدعم Docker).
- مساحة تخزين دائمة لقاعدة البيانات والملفات؛ الملفّات تبقى محلياً في volume اسمه `object_data` افتراضياً.

## التشغيل محلياً أو على خادم Docker

من هذا المجلد (`cloud-storage-app-development`):

```bash
cp .env.example .env
```

أنشئ قيمتين سريتين منفصلتين وضعهما في `.env`:

```bash
openssl rand -hex 32
```

ضع ناتجاً في `POSTGRES_PASSWORD` والآخر في `AUTH_SECRET`، ثم عدّل `APP_BASE_URL` إلى عنوان الموقع. شغّل الموقع:

```bash
docker compose up --build -d
```

يفحص Compose جاهزية PostgreSQL، يطبق مخطط Drizzle، ثم يشغّل Next.js. تحقق من الحالة والسجلات:

```bash
docker compose ps
docker compose logs -f app
```

افتح `http://localhost:3000` محلياً. لإيقاف الخدمات دون حذف البيانات:

```bash
docker compose down
```

لا تستخدم `docker compose down -v` إلا إذا كنت تريد حذف قاعدة البيانات والملفات نهائياً.

## إعداد الإنتاج

1. وجّه النطاق إلى الخادم وضع reverse proxy أمام المنفذ المحدد في `PORT`، مع تفعيل HTTPS وتمرير `Host` و `X-Forwarded-Proto`.
2. حدّث `APP_BASE_URL` في `.env` إلى الرابط العام الكامل مثل `https://drive.example.com`، واستخدم HTTPS دائماً للإنتاج.
3. استخدم قيماً عشوائية قوية وفريدة لـ `POSTGRES_PASSWORD` و `AUTH_SECRET`، ولا ترفع `.env` إلى GitHub.
4. شغّل `docker compose up --build -d` وتأكد أن `/api/health` يعيد `{ "ok": true }`.
5. احتفظ بنسخ احتياطية منتظمة من PostgreSQL و volume الملفات `object_data`. التخزين المحلي مناسب لخادم واحد؛ للبيئات متعددة الخوادم، اضبط S3/R2 المتغيرات في `.env` واجعل `STORAGE_DRIVER=s3`.
6. OAuth من Google والبريد لاستعادة كلمة المرور اختياريان. اضبط بياناتهما في `.env`، وأضف `${APP_BASE_URL}/api/auth/google/callback` إلى قائمة redirect URIs في Google Cloud Console.

## تشغيل التطوير دون Docker للتطبيق

وفّر PostgreSQL، واضبط `DATABASE_URL` و `AUTH_SECRET` في البيئة، ثم من هذا المجلد:

```bash
npm install
npm run db:push
npm run dev
```

استخدم `npm run build && npm start` لتشغيل نسخة إنتاج محلية. يتطلب التطبيق `DATABASE_URL` عند بدء الخادم.
