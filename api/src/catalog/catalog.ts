import { Controller, Get, Header, Injectable, Module, NotFoundException, type OnModuleInit, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { InjectRepository, TypeOrmModule } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { Product } from "./product.entity.js";
import { SEED } from "./seed.js";

@Injectable()
export class CatalogService implements OnModuleInit {
  constructor(@InjectRepository(Product) readonly products: Repository<Product>) {}

  async onModuleInit() {
    if ((await this.products.count()) === 0) await this.products.save(SEED);
  }

  list() {
    return this.products.find({ order: { category: "ASC", name: "ASC" } });
  }

  async get(slug: string) {
    const product = await this.products.findOneBy({ slug });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }
}

@ApiTags("catalog")
@Controller("products")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.list();
  }

  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.catalog.get(slug);
  }

  /** A generated product picture, so the demo needs no image hosting. */
  @Get(":slug/image.svg")
  @Header("Content-Type", "image/svg+xml")
  @Header("Cache-Control", "public, max-age=86400")
  async image(@Param("slug") slug: string) {
    const p = await this.catalog.get(slug);
    // Letters only: a name like "Yerba & sugar" must not put a raw "&" into the XML.
    const initials = p.name.split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${p.color}"/><circle cx="200" cy="150" r="90" fill="#ffffff22"/><text x="200" y="172" font-family="system-ui,sans-serif" font-size="64" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService, TypeOrmModule],
})
export class CatalogModule {}
