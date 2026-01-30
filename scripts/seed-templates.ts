import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultTemplates = [
  {
    name: 'DREAMIT',
    displayName: 'DreamIT',
    primaryColor: '#0C4A6E',
    secondaryColor: '#0EA5E9',
    textColor: '#1F2937',
    mutedColor: '#6B7280',
    website: 'www.dreamit-astek.fr',
    config: JSON.stringify({
      logos: {
        header: {
          width: 1800,
          height: 600,
          marginTop: 360,
          marginLeft: 360,
          position: 'top-left',
        },
        footer: {
          width: 1200,
          height: 400,
          position: 'center',
        },
      },
      margins: {
        top: 1800,
        bottom: 1440,
        left: 1080,
        right: 1080,
      },
      fonts: {
        family: 'Arial',
        titleSize: 48,
        heading2Size: 28,
        heading3Size: 22,
        bodySize: 22,
        smallSize: 18,
      },
      spacing: {
        afterTitle: 400,
        afterHeading2: 200,
        afterHeading3: 100,
        afterParagraph: 120,
        afterListItem: 60,
        beforeSection: 300,
        experienceSeparator: 200,
      },
      pagination: {
        keepWithNext: true,
        keepLines: true,
        widowControl: true,
      },
      styles: {
        heading2Uppercase: true,
        heading2Border: true,
        initialsStyle: 'none',
      },
      sections: [
        'initials',
        'title',
        'keySkills',
        'bio',
        'competences',
        'experience',
        'formations',
        'certifications',
        'projetsPersonnels',
        'langues',
      ],
    }),
  },
  {
    name: 'RUPTURAE',
    displayName: 'Rupturae',
    primaryColor: '#7C3AED',
    secondaryColor: '#A78BFA',
    textColor: '#1F2937',
    mutedColor: '#6B7280',
    website: 'www.rupturae.com',
    config: JSON.stringify({
      logos: {
        header: {
          width: 1800,
          height: 600,
          marginTop: 360,
          marginLeft: 360,
          position: 'top-left',
        },
        footer: {
          width: 1200,
          height: 400,
          position: 'center',
        },
      },
      margins: {
        top: 1800,
        bottom: 1440,
        left: 1080,
        right: 1080,
      },
      fonts: {
        family: 'Arial',
        titleSize: 48,
        heading2Size: 28,
        heading3Size: 22,
        bodySize: 22,
        smallSize: 18,
      },
      spacing: {
        afterTitle: 400,
        afterHeading2: 200,
        afterHeading3: 100,
        afterParagraph: 120,
        afterListItem: 60,
        beforeSection: 300,
        experienceSeparator: 200,
      },
      pagination: {
        keepWithNext: true,
        keepLines: true,
        widowControl: true,
      },
      styles: {
        heading2Uppercase: false,
        heading2Border: true,
        initialsStyle: 'none',
      },
      sections: [
        'initials',
        'title',
        'keySkills',
        'bio',
        'competences',
        'experience',
        'formations',
        'certifications',
        'projetsPersonnels',
        'langues',
      ],
      incomplete: true,
    }),
  },
];

async function main() {
  console.log('Seeding templates...');

  for (const template of defaultTemplates) {
    const existing = await prisma.template.findUnique({
      where: { name: template.name },
    });

    if (existing) {
      console.log(`  Template ${template.name} already exists, updating...`);
      await prisma.template.update({
        where: { name: template.name },
        data: template,
      });
    } else {
      console.log(`  Creating template ${template.name}...`);
      await prisma.template.create({
        data: template,
      });
    }
  }

  console.log('✅ Templates seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
