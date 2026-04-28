import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder";
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
