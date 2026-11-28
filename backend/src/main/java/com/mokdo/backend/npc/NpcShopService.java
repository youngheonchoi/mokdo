package com.mokdo.backend.npc;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class NpcShopService {
    private final JdbcTemplate jdbc;
    public NpcShopService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<Npc> npcs() {
        return jdbc.query("SELECT npc_id, npc_code, name, dialogue FROM gm_npc WHERE status = 'ACT' ORDER BY reg_dtm, npc_id",
                (rs, row) -> new Npc(rs.getObject("npc_id", UUID.class), rs.getString("npc_code"), rs.getString("name"), rs.getString("dialogue")));
    }

    public Shop shop(UUID npcId) {
        Npc npc = activeNpc(npcId, false);
        var items = jdbc.query("""
                SELECT s.npc_shop_item_id, i.item_id, i.name, i.item_type, i.description, i.heal_hp,
                       i.required_level, i.attack, i.defense, i.hp, s.price
                FROM gm_npc_shop_item s JOIN gm_item i ON i.item_id = s.item_id
                WHERE s.npc_id = ? AND s.sale_status = 'ACT' AND i.status = 'ACT'
                ORDER BY s.sort_order, i.name, i.item_code
                """, (rs, row) -> new ShopItem(rs.getObject("npc_shop_item_id", UUID.class), rs.getObject("item_id", UUID.class),
                rs.getString("name"), rs.getString("item_type"), rs.getString("description"), rs.getInt("heal_hp"),
                rs.getInt("required_level"), rs.getInt("attack"), rs.getInt("defense"), rs.getInt("hp"), Long.toString(rs.getLong("price"))), npcId);
        return new Shop(npc, items);
    }

    private Npc activeNpc(UUID id, boolean lock) {
        return jdbc.query("SELECT npc_id, npc_code, name, dialogue FROM gm_npc WHERE npc_id = ? AND status = 'ACT'" + (lock ? " FOR SHARE" : ""),
                (rs, row) -> new Npc(rs.getObject("npc_id", UUID.class), rs.getString("npc_code"), rs.getString("name"), rs.getString("dialogue")), id)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "이 상점은 지금 이용할 수 없어요."));
    }

    @Transactional
    public Purchase purchase(UUID memberId, UUID characterId, UUID npcId, UUID shopItemId, int quantity, String unitPrice) {
        if (quantity < 1 || quantity > 99 || shopItemId == null || unitPrice == null || !unitPrice.matches("0|[1-9][0-9]{0,18}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "구매할 상품과 수량을 확인해 주세요.");
        }
        var balances = jdbc.query("SELECT currency FROM gm_character WHERE character_id = ? AND member_id = ? FOR UPDATE",
                (rs, row) -> rs.getLong("currency"), characterId, memberId);
        if (balances.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "캐릭터를 찾을 수 없어요.");
        activeNpc(npcId, true);
        var offers = jdbc.query("""
                SELECT i.item_id, i.name, i.item_type, s.price
                FROM gm_npc_shop_item s JOIN gm_item i ON i.item_id = s.item_id
                WHERE s.npc_shop_item_id = ? AND s.npc_id = ? AND s.sale_status = 'ACT' AND i.status = 'ACT'
                FOR SHARE OF s, i
                """, (rs, row) -> new Offer(rs.getObject("item_id", UUID.class), rs.getString("name"), rs.getString("item_type"), rs.getLong("price")), shopItemId, npcId);
        if (offers.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "판매가 종료된 상품이에요. 상점 목록을 다시 확인해 주세요.");
        var offer = offers.getFirst();
        if (!Long.toString(offer.price()).equals(unitPrice)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "상품 가격이 변경됐어요. 새 가격을 확인한 뒤 다시 구매해 주세요.");
        }
        long total;
        try { total = Math.multiplyExact(offer.price(), quantity); }
        catch (ArithmeticException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "구매 금액이 너무 커요. 수량을 줄여 주세요."); }
        long balance = balances.getFirst();
        if (balance < total) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "재화가 부족해요.");
        jdbc.update("UPDATE gm_character SET currency = ?, mod_dtm = CURRENT_TIMESTAMP WHERE character_id = ?", balance - total, characterId);
        if (offer.type().equals("WEAPON") || offer.type().equals("HAT")) {
            jdbc.update("""
                    INSERT INTO gm_character_item (character_item_id, character_id, item_id, quantity)
                    SELECT gen_random_uuid(), ?, ?, 1 FROM generate_series(1, ?)
                    """, characterId, offer.itemId(), quantity);
        } else {
            var stacks = jdbc.query("""
                    SELECT character_item_id FROM gm_character_item
                    WHERE character_id = ? AND item_id = ? AND quantity <= ? ORDER BY reg_dtm, character_item_id LIMIT 1 FOR UPDATE
                    """, (rs, row) -> rs.getObject(1, UUID.class), characterId, offer.itemId(), Integer.MAX_VALUE - quantity);
            if (stacks.isEmpty()) jdbc.update("INSERT INTO gm_character_item (character_item_id, character_id, item_id, quantity) VALUES (?, ?, ?, ?)",
                    UUID.randomUUID(), characterId, offer.itemId(), quantity);
            else jdbc.update("UPDATE gm_character_item SET quantity = quantity + ?, mod_dtm = CURRENT_TIMESTAMP WHERE character_item_id = ?", quantity, stacks.getFirst());
        }
        return new Purchase(offer.name(), quantity, Long.toString(total), Long.toString(balance - total));
    }

    public record Npc(UUID npcId, String npcCode, String name, String dialogue) { }
    public record Shop(Npc npc, List<ShopItem> items) { }
    public record ShopItem(UUID npcShopItemId, UUID itemId, String name, String itemType, String description,
            int healHp, int requiredLevel, int attack, int defense, int hp, String price) { }
    public record Purchase(String name, int quantity, String totalPrice, String currency) { }
    private record Offer(UUID itemId, String name, String type, long price) { }
}
