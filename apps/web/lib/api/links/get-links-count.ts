import { prisma } from "@/lib/prisma";
import z from "@/lib/zod";
import { getLinksCountQuerySchema } from "@/lib/zod/schemas/links";
import { combineTagIds } from "./utils";

export async function getLinksCount({
  searchParams,
  workspaceId,
  allowedFolderIds,
}: {
  searchParams: z.infer<typeof getLinksCountQuerySchema>;
  workspaceId: string;
  allowedFolderIds: string[];
}) {
  const {
    groupBy,
    search,
    domain,
    tagId,
    tagIds,
    tagNames,
    userId,
    showArchived,
    withTags,
    folderId,
  } = searchParams;

  const combinedTagIds = combineTagIds({ tagId, tagIds });

  const linksWhere = {
    projectId: workspaceId,
    archived: showArchived ? undefined : false,
    ...(search && {
      OR: [
        {
          shortLink: { contains: search },
        },
        {
          url: { contains: search },
        },
      ],
    }),
    // when filtering by domain, only filter by domain if the filter group is not "Domains"
    ...(domain &&
      groupBy !== "domain" && {
        domain,
      }),
    // when filtering by user, only filter by user if the filter group is not "Users"
    ...(userId &&
      groupBy !== "userId" && {
        userId,
      }),

    ...(folderId &&
      groupBy !== "folderId" && {
        folderId,
      }),

    AND: {
      OR: [{ folderId: { in: allowedFolderIds } }, { folderId: null }],
    },
  };

  if (groupBy === "tagId") {
    return await prisma.linkTag.groupBy({
      by: ["tagId"],
      where: {
        link: linksWhere,
      },
      _count: true,
      orderBy: {
        _count: {
          tagId: "desc",
        },
      },
    });
  } else {
    const where = {
      ...linksWhere,
      ...(withTags && {
        tags: {
          some: {},
        },
      }),
      ...(combinedTagIds && combinedTagIds.length > 0
        ? {
            tags: { some: { tagId: { in: combinedTagIds } } },
          }
        : tagNames
          ? {
              tags: {
                some: {
                  tag: {
                    name: {
                      in: tagNames,
                    },
                  },
                },
              },
            }
          : {}),

      AND: {
        OR: [{ folderId: { in: allowedFolderIds } }, { folderId: null }],
      },
    };

    if (
      groupBy === "domain" ||
      groupBy === "userId" ||
      groupBy === "folderId"
    ) {
      return await prisma.link.groupBy({
        by: [groupBy],
        where,
        _count: true,
        orderBy: {
          _count: {
            [groupBy]: "desc",
          },
        },
      });
    } else {
      return await prisma.link.count({
        where,
      });
    }
  }
}
