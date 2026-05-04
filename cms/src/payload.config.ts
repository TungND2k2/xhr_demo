import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder";
import { s3Storage } from "@payloadcms/storage-s3";
import { vi } from "@payloadcms/translations/languages/vi";
import { en } from "@payloadcms/translations/languages/en";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Workers } from "./collections/Workers";
import { Orders } from "./collections/Orders";
import { OrderWorkers } from "./collections/OrderWorkers";
import { Contracts } from "./collections/Contracts";
import { Workflows } from "./collections/Workflows";
import { WorkflowStages } from "./collections/WorkflowStages";
import { Media } from "./collections/Media";
import { Counters } from "./collections/Counters";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  i18n: {
    fallbackLanguage: "vi",
    supportedLanguages: { vi, en },
  },
  admin: {
    user: "users",
    meta: {
      title: "xHR",
      titleSuffix: " · xHR",
      description: "Trợ lý AI quản lý xuất khẩu lao động",
    },
    importMap: {
      baseDir: dirname,
    },
    components: {
      graphics: {
        Icon: "/components/admin/Icon",
        Logo: "/components/admin/Logo",
      },
    },
    // Custom CSS — load qua app/(payload)/custom.scss đã wire trong layout
  },
  collections: [
    Users,
    Workers,
    Orders,
    OrderWorkers,
    Contracts,
    Workflows,
    WorkflowStages,
    Media,
    Counters,
  ],
  plugins: [
    // S3-compatible storage cho collection media. Endpoint do .env định nghĩa
    // (xorcloud / R2 / MinIO / AWS đều dùng chung adapter này). forcePathStyle
    // bật để tương thích với MinIO-style endpoints.
    s3Storage({
      enabled: !!process.env.S3_BUCKET,
      collections: { media: true },
      bucket: process.env.S3_BUCKET ?? "",
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? "us-east-1",
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY ?? "",
          secretAccessKey: process.env.S3_SECRET_KEY ?? "",
        },
      },
    }),
    formBuilderPlugin({
      // Manager + admin tự build form qua giao diện kéo thả
      // — dùng cho hồ sơ đăng ký LĐ, đánh giá đào tạo, khảo sát sau XK...
      fields: {
        text: true,
        textarea: true,
        select: true,
        radio: true,
        checkbox: true,
        number: true,
        date: true,
        email: false,
        state: false,
        country: false,
        message: true,
        payment: false,
      },
      formOverrides: {
        slug: "forms",
        labels: { singular: "Form mẫu", plural: "Form mẫu" },
        admin: { group: "Form & Quy trình" },
        access: {
          read: ({ req: { user } }) => !!user,
          create: ({ req: { user } }) =>
            ["admin", "manager"].includes(user?.role ?? ""),
          update: ({ req: { user } }) =>
            ["admin", "manager"].includes(user?.role ?? ""),
          delete: ({ req: { user } }) => user?.role === "admin",
        },
      },
      formSubmissionOverrides: {
        slug: "form-submissions",
        labels: { singular: "Form đã nộp", plural: "Form đã nộp" },
        admin: { group: "Form & Quy trình" },
        access: {
          read: ({ req: { user } }) => !!user,
          create: () => true,
          update: ({ req: { user } }) =>
            ["admin", "manager"].includes(user?.role ?? ""),
          delete: ({ req: { user } }) => user?.role === "admin",
        },
      },
    }),
  ],
  editor: lexicalEditor(),
  db: mongooseAdapter({
    url: process.env.DATABASE_URI ?? "mongodb://localhost:27017/xhr_cms",
  }),
  secret: process.env.PAYLOAD_SECRET ?? "default-dev-secret-change-me",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  graphQL: {
    schemaOutputFile: path.resolve(dirname, "schema.graphql"),
  },
  sharp,
});
